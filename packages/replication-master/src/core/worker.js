'use strict'

const pkg = require('../../package.json')
const findBaseDir = require('ipfs-registry-mirror-common/utils/find-base-dir')

let lastWorker = 0

module.exports = () => {
  return async (request, response, next) => {
    const info = {
      index: lastWorker
    }

    response.statusCode = 200
    response.setHeader('Content-type', 'application/json; charset=utf-8')
    response.send(JSON.stringify(info, null, request.query.format === undefined ? 0 : 2))

    lastWorker = lastWorker++
  }
}
