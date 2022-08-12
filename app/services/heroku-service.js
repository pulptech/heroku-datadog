const axios = require('axios')
const winston = require('winston')

const { herokuApiUrl, herokuAppNameManaged, herokuToken } = require('../../configuration/index')

module.exports = {
  restartDynos: () => {
    winston.info('Restarting dynos on app', herokuAppNameManaged)

    const headers = {
      Authorization: `Bearer ${herokuToken}`,
    }
    const path = `/apps/${herokuAppNameManaged}/dynos`
    console.log('axios', axios)

    return axios
      .delete(path, {
        baseURL: herokuApiUrl,
        headers,
      })
      .then(result => {
        console.log('restartDynos result', result.data)
        winston.info('Dynos restarted successfully')
        return result.data
      })
      .catch(error => {
        console.log('restartDynos error', error)
        winston.error('Failed to restart dynos', error)
        throw error
      })
  }
}
