'use strict'

const follow = require('@achingbrain/follow-registry')
const debug = require('debug')('ipfs:registry-mirror:clone')
const sequenceFile = require('./sequence-file')
const log = require('ipfs-registry-mirror-common/utils/log')
const cluster = require('cluster')

let processed = []

module.exports = (emitter, options) => {
  log(`🦎 Replicating registry with concurrency ${options.follow.concurrency}...`)

  return new Promise((resolve) => {
    follow(Object.assign({}, options.follow, {
      handler: (data, callback) => {
        if (!data.json || !data.json.name) {
          return callback() // Bail, something is wrong with this change
        }

        const worker = cluster.fork()
        worker.on('online', () => {
          worker.updateStart = Date.now()

          worker.send({
            options,
            data
          })
        })
        worker.on('message', (message) => {
          if (message.error) {
            const err = new Error(message.error.message)
            err.stack = message.error.stack
            err.code = message.error.code

            debug(err)
            log(`💥 [${data.seq}] error processing ${data.json.name}`, err)
          } else {
            processed.push(Date.now())
            const oneHourAgo = Date.now() - 3600000

            processed = processed.filter(time => {
              return time > oneHourAgo
            })

            log(`🦕 [${data.seq}] processed ${data.json.name} in ${Date.now() - worker.updateStart}ms, ${(processed.length / 3600).toFixed(3)} modules/s`)

            emitter.emit('processed', data.json)
            emitter.emit('seq', data.seq)
          }

          worker.kill()
        })
        worker.on('exit', (code, signal) => {
          callback()
        })
      },
      seq: sequenceFile(options)
    }), (stream) => {
      stream.on('restart', () => {
        log('🔃 Feed restarting due to inactivity')
      })

      stream.on('error', (error) => {
        log(`💥 Feed error`, error)
      })

      resolve(stream)
    })
  })
}
