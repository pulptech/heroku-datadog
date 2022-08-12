const axios = require('axios')

const { herokuApiUrl, herokuAppNameManaged, herokuToken } = require('../../configuration/index')

module.exports = {
  restartDynos: () => {
    const headers = {
      Authorization: `Bearer ${herokuToken}`,
    }
    const path = `/apps/${herokuAppNameManaged}/dynos`

    return axios
      .delete(path, {
        baseURL: herokuApiUrl,
        headers,
      })
      .then(result => {
        console.log('restartDynos result', result.data)
        return result.data
      })
      .catch(error => {
        console.log('restartDynos error', error)
        throw error
      })
  }
}
