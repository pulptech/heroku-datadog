const axios = require('axios')
const winston = require('winston')

const { herokuApiUrl, herokuAppNameManaged, herokuToken } = require('../../configuration/index')

module.exports = {
  restartDynos: () => {
    winston.info('Restarting dynos on app', herokuAppNameManaged)

    const headers = {
      Authorization: `Bearer ${herokuToken}`,
      Accept: 'application/vnd.heroku+json; version=3'
    }
    const path = `/apps/${herokuAppNameManaged}/dynos`

    return axios
      .delete(path, {
        baseURL: herokuApiUrl,
        headers,
      })
      .then(result => {
        winston.info('Dynos restarted successfully')
        return result.data
      })
      .catch(error => {
        winston.error('Failed to restart dynos', error)
        throw error
      })
  }
}
