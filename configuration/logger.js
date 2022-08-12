const winston = require('winston')
const { appLogLevel } = require('./index')

module.exports = {
  configureLogger: () => {
    const transports = [new winston.transports.Console()]

    const format = winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )

    winston.configure({
      level: appLogLevel,
      transports,
      defaultMeta: {},
      format,
    })
  }
}
