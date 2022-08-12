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
  const timeoutsCountsPermMinute = computeTimeoutsPerMinute({ logArray })

  return incrementTimeoutCounters({ timeoutsCountsPermMinute }, { redis })
    .then(() => computeTotalTimeoutsOnInterval({ redis }))
    .then(totalTimeoutsOnInterval => handleTimeoutsAmountOnInterval(
      { totalTimeoutsOnInterval },
      { redis },
    ))
}

function computeTimeoutsPerMinute({ logArray }) {
  return logArray.reduce((timeoutsCountsPermMinute, log) => {
    const logMatchesTimeout = log.match(TIMEOUT_REGEX)

    if (logMatchesTimeout) {
      const logDateTime = moment(log.split(' ')[0])
      const logMinute = logDateTime.minute()

      const newCountValue  = timeoutsCountsPermMinute[logMinute] ? timeoutsCountsPermMinute[logMinute] + 1 : 1
      timeoutsCountsPermMinute[logMinute] = newCountValue
    }

    return timeoutsCountsPermMinute
  }, {})
}

function generateTimeoutsCounterRedisKey({ minute }) {
  return `timeouts_counter:minute${minute}`
}

function generateLastDynosRestartDateTimeRedisKey() {
  return 'timeouts:last_dyno_restart_date_time'
}

function incrementTimeoutCounters({ timeoutsCountsPermMinute }, { redis }) {
  return Object.entries(timeoutsCountsPermMinute).reduce((redisPromise, [minute, countForBatchLog]) => {
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
      const minuteIsBeginningOfHour = currentLogMinute === 0
      const logMinuteCounterToGet = minuteIsBeginningOfHour? 59 : currentLogMinute - index
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
