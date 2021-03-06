'use strict'

const follow = require('@achingbrain/follow-registry')
const debug = require('debug')('ipfs:registry-mirror:clone')
const sequenceFile = require('../sequence-file')
const log = require('ipfs-registry-mirror-common/utils/log')
const cluster = require('cluster')
const delay = require('delay')
const mainThreadWorker = require('./main-thread-worker')

let processed = []

const stats = {
  update () {
    processed.push(Date.now())
    const oneHourAgo = Date.now() - 3600000

    processed = processed.filter(time => {
      return time > oneHourAgo
    })
  },
  modulesPerSecond () {
    return (processed.length / 3600).toFixed(3)
  }
}

const createWorker = () => {
  return new Promise((resolve, reject) => {
    const worker = cluster.fork()
    worker.on('online', () => {
      resolve()
    })
    worker.on('error', (err) => {
      reject(err)
    })
    worker.on('disconnect', () => {
      // console.info('Worker disconnected')
    })
    worker.on('exit', (code, signal) => {
      // console.info('Worker exited with code', code, 'and signal', signal)
    })
  })
}

const fillWorkerPool = async (options) => {
  // ensure worker pool is full
  if (Object.keys(cluster.workers).length === options.clone.concurrency) {
    return
  }

  while (Object.keys(cluster.workers).length < options.clone.concurrency) {
    await createWorker()
  }
}

const findWorker = async (ipfs, options) => {
  if (options.clone.concurrency === 0) {
    return mainThreadWorker(ipfs)
  }

  await fillWorkerPool(options)

  // wait for a free worker
  while (true) {
    const worker = Object
      .values(cluster.workers)
      .find(worker => !worker.processing)

    if (worker) {
      return worker
    }

    await delay(5000)
  }
}

module.exports = async (emitter, signal, ipfs, options) => {
  log(`🦎 Replicating registry with concurrency ${options.follow.concurrency}...`)

  if (options.clone.concurrency) {
    log(`👷 Using ${options.clone.concurrency} workers to process updates`)
  } else {
    log('👷 Processing package updates on main thread')
  }

  await fillWorkerPool(options)

  while (true) {
    try {
      for await (const { packument, seq, done } of follow({ ...options.follow, seq: sequenceFile(options) })) {
        if (signal.aborted) {
          return
        }

        if (!packument || !packument.name) {
          // invalid response from npm
          done().then(() => {}, () => {})
          continue
        }

        const worker = await findWorker(ipfs, options)
        worker.updateStart = Date.now()
        worker.processing = true

        worker.once('message', (message) => {
          worker.processing = false

          if (message.error) {
            const err = new Error(message.error.message)
            err.stack = message.error.stack
            err.code = message.error.code

            debug(err)
            log(`💥 [${message.seq}] error processing ${message.name}`, err)
          } else {
            stats.update()

            log(`🦕 [${message.seq}] processed ${message.name} in ${Date.now() - worker.updateStart}ms, ${stats.modulesPerSecond()} modules/s`)

            emitter.emit('processed', message.name)
            emitter.emit('seq', message.seq)
          }

          done().then(() => {}, () => {})
        })

        worker.send({
          packument,
          seq,
          options
        })
      }
    } catch (err) {
      log('💥 Feed error', err)
    }
  }
}
