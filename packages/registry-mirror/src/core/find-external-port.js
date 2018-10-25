'use strict'

const request = require('ipfs-registry-mirror-common/utils/retry-request')

module.exports = async (options) => {
  const docker = await request(Object.assign({}, {
    uri: 'http://unix:/tmp/docker.sock:/containers/' + process.env.HOSTNAME + '/json',
    json: true,
    retries: 100,
    retryDelay: 5000,
    headers: {
      host: ' '
    }
  }))

  return docker.NetworkSettings.Ports[`${options.ipfs.port}/tcp`][0].HostPort
}
