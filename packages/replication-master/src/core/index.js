'use strict'

const config = require('./config')
const clone = require('./clone')
const replicationMaster = require('./pubsub')
const advertise = require('./mdns')
const server = require('ipfs-registry-mirror-common/server')
const root = require('./routes/root')
const worker = require('./routes/worker')
const workerOnline = require('./routes/worker-online')
const delay = require('delay')
const {
  status
} = require('./routes/workers')
const log = require('ipfs-registry-mirror-common/utils/log')
const AbortController = require('abort-controller')

module.exports = async (options) => {
  options = config(options)

  if (!options.ipfs.pass) {
    throw new Error('Please supply a keystore password with the --ipfs-pass option')
  }

  const result = await server(options, async (app, ipfs) => {
    const res = await replicationMaster(options, ipfs, app)

    app.get('/', root(options, ipfs, app, res.root, res.topic))
    app.get('/-/worker', worker())
    app.post('/-/worker', workerOnline())
  })

  // give workers a chance to connect
  const time = Date.now()
  log(`⌚ Waiting for ${options.clone.delay}ms before starting to clone npm`)

  await delay(options.clone.delay || 0)

  const workerStatus = status()

  if (!workerStatus.ready) {
    log(`⌚ Waiting for ${workerStatus.workers.length - workerStatus.initialised} of ${workerStatus.workers.length} workers to be ready before starting to clone npm`)

    while (true) {
      await delay(options.clone.delay || 0)

      if (status().ready) {
        break
      }

      log(`⌚ Still waiting for ${workerStatus.workers.length - workerStatus.initialised} of ${workerStatus.workers.length} workers to be ready before starting to clone npm`)
    }
  }

  log(`⌚ Workers took ${Date.now() - time}ms to initialise`)

  const controller = new AbortController()

  clone(result.app, controller.signal, options)
    .then(() => {}, () => {})

  const stop = result.stop
  const advert = advertise(result.ipfs, options)

  result.stop = () => {
    controller.abort()
    advert.stop()
    stop()
  }

  return result
}
