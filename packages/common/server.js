'use strict'

const express = require('express')
const once = require('once')
const {
  errorLog,
  favicon,
  requestLog,
  cors
} = require('./handlers')
const prometheus = require('express-prom-bundle')
const promisify = require('util').promisify
const metrics = prometheus({
  includeMethod: true,
  autoregister: false
})
const log = require('./utils/log')
const getAnIPFS = require('./utils/get-an-ipfs')

module.exports = async (config, handlers = async () => {}) => {
  const ipfs = await getAnIPFS(config)

  log('🛫 Starting server')

  const app = express()
  app.use(requestLog)

  app.use(metrics)
  app.use('/-/metrics', metrics.metricsMiddleware)

  app.use(cors)

  app.get('/favicon.ico', favicon(config, ipfs, app))
  app.get('/favicon.png', favicon(config, ipfs, app))

  await handlers(app, ipfs)

  app.use(errorLog)

  return new Promise((resolve, reject) => {
    const callback = once((error) => {
      if (error) {
        reject(error)
      }

      if (!config.http.port) {
        config.http.port = server.address().port
      }

      log(`🚀 Server running on port ${config.http.port}`)

      resolve({
        server,
        app,
        ipfs,
        stop: () => {
          return Promise.all([
            promisify(server.close.bind(server))(),
            ipfs.stop()
          ])
            .then(() => {
              log('✋ Server stopped')
            })
        }
      })
    })

    const server = app.listen(config.http.port, callback)
    server.once('error', callback)

    app.locals.ipfs = ipfs
  })
}
