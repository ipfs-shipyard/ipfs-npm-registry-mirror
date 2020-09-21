'use strict'

const { default: PQueue } = require('p-queue')
const EventEmitter = require('events').EventEmitter
const ingestModule = require('./ingest-module')

const queue = new PQueue({ concurrency: 1 })
let ipfs

const mainWorker = new EventEmitter()
mainWorker.send = ({
  packument,
  seq,
  options
}) => {
  queue.add(async () => {
    try {
      mainWorker.emit('message', await ingestModule({ packument, seq, ipfs, options }))
    } catch (error) {
      mainWorker.emit('message', {
        seq,
        name: packument.name,
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code
        }
      })
    }
  })
}

const mainThreadWorker = async (i) => {
  ipfs = i
  await queue.onIdle()

  return mainWorker
}

module.exports = mainThreadWorker
