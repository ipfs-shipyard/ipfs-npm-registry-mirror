'use strict'

const config = require('./config')
const clone = require('./clone')
const replicationMaster = require('./pubsub')
const server = require('ipfs-registry-mirror-common/server')
const root = require('./root')
const worker = require('./worker')
const delay = require('promise-delay')

module.exports = async (options) => {
  options = config(options)

  const result = await server(options, async (app, ipfs) => {
    const res = await replicationMaster(options, ipfs, app)

    app.get('/', root(options, ipfs, app, res.root, res.topic))
    app.get('/-/worker', worker())
  })

  // give workers a chance to connect
  console.info(`⌚ Waiting for ${options.clone.delay}ms before starting to clone npm`)
  await delay(options.clone.delay || 0)

  const feed = await clone(options, result.ipfs, result.app)

  const stop = result.stop

  result.stop = () => {
    feed.stop()
    stop()
  }

  return result
}
