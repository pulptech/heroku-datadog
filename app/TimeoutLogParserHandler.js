const moment = require('moment')
const winston = require('winston')

const {
  intervalInMinutesToCalculateTimeoutsOn,
  amountOfAcceptedTimeoutsOnInterval,
  delayInSecondsToTriggerDynosRestart
} = require('../configuration/index')
const herokuService = require('./services/heroku-service')

const TEN_MINUTES_IN_SECONDS = 10 * 60
const TWO_HOURS_IN_SECONDS = 2 * 60 * 60
const FIVE_SECONDS = 5000

const TIMEOUT_REGEX = /code=H12/

module.exports = function ({ redisSingleton }) {
  const redis = redisSingleton

  let logsToParseQueue = []
  let interval = null

  return {
    startHandler: () => {
      interval = setInterval(() => {
        const logsBatchBeforeParse = [...logsToParseQueue]
        return parseLogBatches({ logsToParseQueue: logsBatchBeforeParse }, { redis })
          .then(() => {
            logsToParseQueue = logsToParseQueue.filter(log => !logsBatchBeforeParse.includes(log))
          })
          .catch(winston.error)
      }, FIVE_SECONDS)
    },
    addNewLogBatch: ({ logArray }) => {
      logsToParseQueue = [...logsToParseQueue, ...logArray]
    },
  }
}

function parseLogBatches({ logsToParseQueue }, { redis }) {
  console.log('logsToParseQueue', logsToParseQueue)
  if (!logsToParseQueue.length) {
    return
  }
  const timeoutsCountsPerMinute = computeTimeoutsPerMinute({ logArray: logsToParseQueue })

  return incrementTimeoutCounters({ timeoutsCountsPerMinute }, { redis })
    .then(() => computeTotalTimeoutsOnInterval({ redis }))
    .then(totalTimeoutsOnInterval => handleTimeoutsAmountOnInterval(
      { totalTimeoutsOnInterval },
      { redis },
    ))
}

function computeTimeoutsPerMinute({ logArray }) {
  return logArray.reduce((timeoutsCountsPerMinute, log) => {
    const logMatchesTimeout = log.match(TIMEOUT_REGEX)

    if (logMatchesTimeout) {
      const logDateTime = moment(log.split(' ')[0])
      const logMinute = logDateTime.minute()

      const newCountValue  = timeoutsCountsPerMinute[logMinute] ? timeoutsCountsPerMinute[logMinute] + 1 : 1
      timeoutsCountsPerMinute[logMinute] = newCountValue
    }

    return timeoutsCountsPerMinute
  }, {})
}

function generateTimeoutsCounterRedisKey({ minute }) {
  return `timeouts_counter:minute${minute}`
}

function generateLastDynosRestartDateTimeRedisKey() {
  return 'timeouts:last_dyno_restart_date_time'
}

function incrementTimeoutCounters({ timeoutsCountsPerMinute }, { redis }) {
  return Object.entries(timeoutsCountsPerMinute).reduce((redisPromise, [minute, countForBatchLog]) => {
    const timeoutCounterRedisKey = generateTimeoutsCounterRedisKey({ minute })

    return redisPromise.then(() => {
      return redis.get(timeoutCounterRedisKey)
        .then(oldCountValue => {
          if(!oldCountValue) {
            return redis.set(timeoutCounterRedisKey, countForBatchLog, 'EX', TEN_MINUTES_IN_SECONDS)
          }
          const newValue = oldCountValue + countForBatchLog
          return redis.set(timeoutCounterRedisKey, newValue)
        })
        .then(newCounterValue => {
          return Promise.resolve()
        })
    })
  }, Promise.resolve())
}

function computeTotalTimeoutsOnInterval({ redis }) {
  const currentLogMinute = moment().minute()
  let totalTimeoutsOnInterval = 0

  return Array(intervalInMinutesToCalculateTimeoutsOn)
    .fill(null)
    .reduce((redisPromise, _element, index) => {
      const minuteIsBeginningOfHour = currentLogMinute === 0
      const logMinuteCounterToGet = minuteIsBeginningOfHour ? 59 : (currentLogMinute - index)
      const timeoutCounterRedisKey = generateTimeoutsCounterRedisKey({ minute: logMinuteCounterToGet })

      return redisPromise.then(() => {
        return redis.get(timeoutCounterRedisKey)
          .then(totalTimeoutOnMinute => {
            if(totalTimeoutOnMinute) {
              totalTimeoutsOnInterval += parseInt(totalTimeoutOnMinute)
            }
          })
      })
    }, Promise.resolve())
}

function handleTimeoutsAmountOnInterval({ totalTimeoutsOnInterval }, { redis }) {
  console.log('handleTimeoutsAmountOnInterval', totalTimeoutsOnInterval)
  const totalTimeoutsOnIntervalIsOverAcceptableAmount = totalTimeoutsOnInterval >= amountOfAcceptedTimeoutsOnInterval
  if( !totalTimeoutsOnIntervalIsOverAcceptableAmount) {
    return
  }

  winston.info(`New timeout amount over accepted quantity detected ${totalTimeoutsOnInterval} one the last ${intervalInMinutesToCalculateTimeoutsOn} minutes`)

  const lastDynosRestartDateTimeRedisKey = generateLastDynosRestartDateTimeRedisKey()
  return redis.get(lastDynosRestartDateTimeRedisKey)
    .then(lastDynosRestartDateTime => {
      const dateTimeWithDelayAfterRestart = moment(lastDynosRestartDateTime).add(delayInSecondsToTriggerDynosRestart, 'seconds')
      const lastRestartHasPassedAcceptableDelay = moment().isAfter(dateTimeWithDelayAfterRestart)

      if (lastDynosRestartDateTime && !lastRestartHasPassedAcceptableDelay) {
        return
      }

      return herokuService.restartDynos()
        .then(() => {
          const newDynosRestartDateTime = moment().toISOString()
          return redis.set(lastDynosRestartDateTimeRedisKey, newDynosRestartDateTime, 'EX', TWO_HOURS_IN_SECONDS)
        })
    })
}
