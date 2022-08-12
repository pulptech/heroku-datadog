const moment = require('moment')

const {
  intervalInMinutesToCalculateTimeoutsOn,
  amountOfAcceptedTimeoutsOnInterval,
  delayInSecondsToTriggerDynosRestart
} = require('../configuration/index')
const herokuService = require('./services/heroku-service')

const TEN_MINUTES_IN_SECONDS = 10 * 60

module.exports = ({ log, redis }) => {
  console.log('timeoutLogParserHandler', log)

  const timeoutMarkRegex = /H12/

  const logMatchesTimeout = log.match(timeoutMarkRegex)
  if(logMatchesTimeout) {
    const logDateTime = moment(log.split(' ')[0])
    return incrementTimeoutCounter({ logDateTime }, { redis })
      .then(() => computeTotalTimeoutsOnInterval({ logDateTime }, { redis }))
      .then(totalTimeoutsOnInterval => handleTimeoutsAmountOnInterval(
        { logDateTime, totalTimeoutsOnInterval },
        { redis },
      ))
  }
}

function generateTimeoutsCounterRedisKey({ minute }) {
  return `timeouts_counter:minute${minute}`
}

function generateLastDynosRestartDateTimeRedisKey() {
  return 'timeouts:last_dyno_restart_date_time'
}

function incrementTimeoutCounter({ logDateTime }, { redis }) {
  const logMinute = logDateTime.minute()

  const timeoutCounterRedisKey = generateTimeoutsCounterRedisKey({ minute: logMinute })

  return redis.multi()
    .incr(timeoutCounterRedisKey)
    .expire(TEN_MINUTES_IN_SECONDS)
    .exec()
}

function computeTotalTimeoutsOnInterval({ logDateTime }, { redis }) {
  const currentLogMinute = logDateTime.minute()
  let totalTimeoutsOnInterval = 0

  return Array(intervalInMinutesToCalculateTimeoutsOn)
    .fill(null)
    .reduce((redisPromise, _element, index) => {
      const logMinuteCounterToGet = currentLogMinute - index
      const timeoutCounterRedisKey = generateTimeoutsCounterRedisKey({ minute: logMinuteCounterToGet })

      return redisPromise.then(() => {
        return redis.get(timeoutCounterRedisKey)
          .then(totalTimeoutOnMinute => {
            totalTimeoutsOnInterval += totalTimeoutOnMinute
          })
      })
    }, Promise.resolve())
}

function handleTimeoutsAmountOnInterval({ logDateTime, totalTimeoutsOnInterval }, { redis }) {
  const totalTimeoutsOnIntervalIsOverAcceptableAmount = totalTimeoutsOnInterval >= amountOfAcceptedTimeoutsOnInterval
  if( !totalTimeoutsOnIntervalIsOverAcceptableAmount) {
    return
  }

  const lastDynosRestartDateTimeRedisKey = generateLastDynosRestartDateTimeRedisKey()
  return redis.get(lastDynosRestartDateTimeRedisKey)
    .then(lastDynosRestartDateTime => {
      const dateTimeWithDelayAfterRestart = moment(lastDynosRestartDateTime).add(delayInSecondsToTriggerDynosRestart, 'seconds')
      const lastRestartHasPassedAcceptableDelay = logDateTime.isAfter(dateTimeWithDelayAfterRestart)

      if (!lastRestartHasPassedAcceptableDelay) {
        return
      }

      const lastDynosRestartDateTimeRedisKey = generateLastDynosRestartDateTimeRedisKey()
      const newDynosRestartDateTime = moment().toISOString()
      return redis.set(lastDynosRestartDateTimeRedisKey, newDynosRestartDateTime)
      return herokuService.restartDynos()
    })
}
