'use strict'

const request = require('ipfs-registry-mirror-common/utils/retry-request')

module.exports = async (options) => {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return 0
  }

  const docker = await request(Object.assign({}, {
    uri: 'http://unix:/tmp/docker.sock:/containers/' + process.env.HOSTNAME + '/json',
    json: true,
    retries: 100,
    retryDelay: 5000,
    headers: {
      host: ' '
    }
  }))

  try {
    return docker.NetworkSettings.Ports[`${options.ipfs.port}/tcp`][0].HostPort
  } catch (err) {
    console.error('Could not find options.ipfs.port', options.ipfs.port, 'in') // eslint-disable-line no-console
    console.info(JSON.stringify(docker.NetworkSettings, null, 2)) // eslint-disable-line no-console

    throw err
  }
}
