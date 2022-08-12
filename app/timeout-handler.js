const moment = require('moment')

const {
  intervalInMinutesToCalculateTimeoutsOn,
  amountOfAcceptedTimeoutsOnInterval,
  delayInSecondsToTriggerDynosRestart
} = require('../configuration/index')
const herokuService = require('./services/heroku-service')

const TEN_MINUTES_IN_SECONDS = 10 * 60
const TIMEOUT_REGEX = /H12/

module.exports = ({ logArray, redis }) => {
  return computeTimeoutsPerMinute({ logArray })
    .then(timeoutsCountsForLogs => incrementTimeoutCounters(
      { timeoutsCountsForLogs },
      { redis },
    ))
    .then(() => computeTotalTimeoutsOnInterval({ redis }))
    .then(totalTimeoutsOnInterval => handleTimeoutsAmountOnInterval(
      { totalTimeoutsOnInterval },
      { redis },
    ))
}

function computeTimeoutsPerMinute({ logArray }) {
  return logArray.reduce((timeoutsCountsForLogs, log) => {
    const logMatchesTimeout = log.match(TIMEOUT_REGEX)

    if (logMatchesTimeout) {
      const logDateTime = moment(log.split(' ')[0])
      const logMinute = logDateTime.minute()

      const newCountValue  = timeoutsCountsForLogs[logMinute] ? timeoutsCountsForLogs[logMinute] + 1 : 1
      timeoutsCountsForLogs[logMinute] = newCountValue
    }

    return timeoutsCountsForLogs
  }, {})
}

function generateTimeoutsCounterRedisKey({ minute }) {
  return `timeouts_counter:minute${minute}`
}

function generateLastDynosRestartDateTimeRedisKey() {
  return 'timeouts:last_dyno_restart_date_time'
}

function incrementTimeoutCounters({ timeoutsCountsForLogs }, { redis }) {
  return Object.entries(timeoutsCountsForLogs).reduce((redisPromise, [minute, countForBatchLog]) => {
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
          console.log('incrementTimeoutCounters', timeoutCounterRedisKey, newCounterValue)
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
      const logMinuteCounterToGet = currentLogMinute - index
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
    .then(() => {
      console.log('totalTimeoutsOnInterval', totalTimeoutsOnInterval)
      return totalTimeoutsOnInterval
    })
}

function handleTimeoutsAmountOnInterval({ totalTimeoutsOnInterval }, { redis }) {
  console.log('totalTimeoutsOnInterval', totalTimeoutsOnInterval, 'amountOfAcceptedTimeoutsOnInterval', amountOfAcceptedTimeoutsOnInterval)
  const totalTimeoutsOnIntervalIsOverAcceptableAmount = totalTimeoutsOnInterval >= amountOfAcceptedTimeoutsOnInterval
  if( !totalTimeoutsOnIntervalIsOverAcceptableAmount) {
    return
  }

  const lastDynosRestartDateTimeRedisKey = generateLastDynosRestartDateTimeRedisKey()
  return redis.get(lastDynosRestartDateTimeRedisKey)
    .then(lastDynosRestartDateTime => {
      const dateTimeWithDelayAfterRestart = moment(lastDynosRestartDateTime).add(delayInSecondsToTriggerDynosRestart, 'seconds')
      const lastRestartHasPassedAcceptableDelay = moment().isAfter(dateTimeWithDelayAfterRestart)

      console.log('lastDynosRestartDateTime', lastDynosRestartDateTime)
      console.log('dateTimeWithDelayAfterRestart', dateTimeWithDelayAfterRestart)
      console.log('lastRestartHasPassedAcceptableDelay', lastRestartHasPassedAcceptableDelay)
      if (!lastDynosRestartDateTime || !lastRestartHasPassedAcceptableDelay) {
        return
      }

      console.log('restart dynos')
      const lastDynosRestartDateTimeRedisKey = generateLastDynosRestartDateTimeRedisKey()
      const newDynosRestartDateTime = moment().toISOString()
      return redis.set(lastDynosRestartDateTimeRedisKey, newDynosRestartDateTime)
      return herokuService.restartDynos()
    })
}
