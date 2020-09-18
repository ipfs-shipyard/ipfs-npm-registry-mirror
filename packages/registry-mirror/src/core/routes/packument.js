'use strict'

const debug = require('debug')('ipfs:registry-mirror:handlers:manifest')
const loadPackument = require('ipfs-registry-mirror-common/utils/load-packument')
const sanitiseName = require('ipfs-registry-mirror-common/utils/sanitise-name')
const lol = require('ipfs-registry-mirror-common/utils/error-message')
const log = require('ipfs-registry-mirror-common/utils/log')
const replaceTarballUrls = require('ipfs-registry-mirror-common/utils/replace-tarball-urls')

module.exports = (config, ipfs, app) => {
  return async (request, response, next) => {
    debug(`Requested ${request.path}`)

    const moduleName = sanitiseName(request.path)

    debug(`Loading packument for ${moduleName}`)

    try {
      let packument = await loadPackument(moduleName, ipfs, config)
      packument = replaceTarballUrls(packument, config)

      response.statusCode = 200
      response.setHeader('Content-type', 'application/json; charset=utf-8')
      response.send(JSON.stringify(packument, null, 2))
    } catch (error) {
      log(`💥 Could not load packument for ${moduleName}`, error)

      if (error.message.includes('Not found')) {
        response.statusCode = 404
        response.send(lol(`💥 Could not load ${moduleName}, has it been published?`))

        return
      }

      // a 500 will cause the npm client to retry
      response.statusCode = 500
      response.send(lol(`💥 ${error.message}`))
    }
  }
}
