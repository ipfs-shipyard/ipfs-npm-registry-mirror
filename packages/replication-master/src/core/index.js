'use strict'

const config = require('./config')
const clone = require('./clone')
const replicationMaster = require('./pubsub')
const server = require('ipfs-registry-mirror-common/server')
const root = require('./root')
const worker = require('./worker')
const workerOnline = require('./worker-online')
const delay = require('promise-delay')
const {
  status
} = require('./workers')

module.exports = async (options) => {
  options = config(options)

  const result = await server(options, async (app, ipfs) => {
    const res = await replicationMaster(options, ipfs, app)

    app.get('/', root(options, ipfs, app, res.root, res.topic))
    app.get('/-/worker', worker())
    app.post('/-/worker', workerOnline())
  })

  // give workers a chance to connect
  const time = Date.now()
  console.info(`⌚ Waiting for ${options.clone.delay}ms before starting to clone npm`) // eslint-disable-line no-console

  await delay(options.clone.delay || 0)

  const workerStatus = status()

  if (!workerStatus.ready) {
    console.info(`⌚ Waiting for ${workerStatus.workers - workerStatus.initialised} of ${workerStatus.workers} workers to be ready before starting to clone npm`) // eslint-disable-line no-console

    while (true) {
      await delay(options.clone.delay || 0)

      if (status().ready) {
        break;
      }

      console.info(`⌚ Still waiting for ${workerStatus.workers - workerStatus.initialised} of ${workerStatus.workers} workers to be ready before starting to clone npm`) // eslint-disable-line no-console
    }
  }

  console.info(`⌚ Workers took ${Date.now() - time}ms to initialise`) // eslint-disable-line no-console

  const feed = await clone(result.app, result.ipfs, options)

  const stop = result.stop

  result.stop = () => {
    feed.stop()
    stop()
  }

  return result
}
