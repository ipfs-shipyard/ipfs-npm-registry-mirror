'use strict'

const debug = require('debug')('ipfs:registry-mirror:handlers:tarball')
const path = require('path')
const loadTarball = require('ipfs-registry-mirror-common/utils/load-tarball')
const lol = require('ipfs-registry-mirror-common/utils/error-message')
const log = require('ipfs-registry-mirror-common/utils/log')

module.exports = (config, ipfs, app) => {
  return async (request, response, next) => {
    debug(`Requested ${request.path}`)

    let file = request.path

    debug(`Loading ${file}`)

    try {
      const readStream = await loadTarball(config, ipfs, file)

      readStream.on('error', (error) => {
        debug(`Error loading ${file} - ${error}`)

        if (error.code === 'ECONNREFUSED') {
          response.statusCode = 504
        } else if (error.code === 'ECONNRESET') {
          // will trigger a retry from the npm client
          response.statusCode = 500
        } else {
          response.statusCode = 404
        }

        next(error)
      })
        .once('data', () => {
          debug(`Loaded ${file}`)

          response.statusCode = 200
          response.setHeader('Content-Disposition', `attachment; filename="${path.basename(request.url)}"`)
        })
        .pipe(response)
    } catch (error) {
      log(`💥 Could not load tarball for ${file}`, error)

      if (error.message.includes('Not found')) {
        response.statusCode = 404
        response.send(lol(`💥 Could not load ${file}, has it been published?`))

        return
      }

      if (error.message.includes('in available versions')) {
        response.statusCode = 404
        response.send(lol(`💥 Could not load ${file}, version unavailable`))

        return
      }

      // a 500 will cause the npm client to retry
      response.statusCode = 500
      response.send(lol(`💥 ${error.message}`))
    }
  }
}
