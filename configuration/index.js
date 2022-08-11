export const intervalInMinutesToCalculateTimeoutsOn = parseInt(process.env.INTERVAL_IN_MINUTES_TO_CALCULATE_TIMEOUTS_ON) || 5
export const amountOfAcceptedTimeoutsOnInterval = parseInt(process.env.AMOUNT_OF_ACCEPTED_TIMEOUTS_ON_INTERVAL) || 100
export const delayInSecondsToTriggerDynosRestart = parseInt(process.env.DELAY_IN_SECONDS_TO_TRIGGER_DYNOS_RESTART) || 120

export const herokuApiUrl = process.env.HEROKU_API_URL
export const herokuAppNameManaged = process.env.HEROKU_APP_NAME
export const herokuToken = process.env.HEROKU_TOKEN

export const redisUrl = process.env.REDIS_URL

