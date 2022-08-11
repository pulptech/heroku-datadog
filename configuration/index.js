module.exports = {
  intervalInMinutesToCalculateTimeoutsOn: parseInt(process.env.INTERVAL_IN_MINUTES_TO_CALCULATE_TIMEOUTS_ON) || 5,
  amountOfAcceptedTimeoutsOnInterval: parseInt(process.env.AMOUNT_OF_ACCEPTED_TIMEOUTS_ON_INTERVAL) || 100,
  delayInSecondsToTriggerDynosRestart: parseInt(process.env.DELAY_IN_SECONDS_TO_TRIGGER_DYNOS_RESTART) || 120,

  herokuApiUrl: process.env.HEROKU_API_URL,
  herokuAppNameManaged: process.env.HEROKU_APP_NAME,
  herokuToken: process.env.HEROKU_TOKEN,

  redisUrl: process.env.REDIS_URL,
}
