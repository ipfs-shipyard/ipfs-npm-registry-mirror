'use strict'

const follow = require('@achingbrain/follow-registry')
const debug = require('debug')('ipfs:registry-mirror:clone')
const sequenceFile = require('./sequence-file')
const log = require('ipfs-registry-mirror-common/utils/log')
const cluster = require('cluster')

let processed = []

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
      console.info('Worker disconnected')
    })
    worker.on('exit', (code, signal) => {
      console.info('Worker exited with code', code, 'and signal', signal)
    })
  })
}

const minimalManifest = (packument) => {
  const versions = {}

  Object.keys(packument.versions).forEach(version => {
    versions[version] = {
      name: packument.versions[version].name,
      version: packument.versions[version].version,
      dependencies: packument.versions[version].dependencies,
      devDependencies: packument.versions[version].devDependencies,
      optionalDependencies: packument.versions[version].optionalDependencies,
      peerDependencies: packument.versions[version].peerDependencies,
      bundledDependencies: packument.versions[version].bundledDependencies,
      directories: packument.versions[version].directories,
      dist: packument.versions[version].dist
    }
  })

  return {
    name: packument.name,
    time: packument.time,
    'dist-tags': packument['dist-tags'],
    versions
  }
}

module.exports = async (emitter, options) => {
  log(`🦎 Replicating registry with concurrency ${options.follow.concurrency}...`)

  return new Promise((resolve) => {
    follow(Object.assign({}, options.follow, {
      handler: async (data, callback) => {
        if (!data.json || !data.json.name) {
          return callback() // Bail, something is wrong with this change
        }

        while(Object.keys(cluster.workers).length < options.follow.concurrency) {
          await createWorker()
        }

        const worker = Object.values(cluster.workers)
          .find(worker => !worker.processing)

        if (!worker) {
          console.error('No workers to process', data.json.name)
        }

        worker.updateStart = Date.now()
        worker.processing = true

        worker.once('message', (message) => {
          worker.processing = false

          if (message.error) {
            const err = new Error(message.error.message)
            err.stack = message.error.stack
            err.code = message.error.code

            debug(err)
            log(`💥 [${message.seq}] error processing ${message.manifest.name}`, err)
          } else {
            processed.push(Date.now())
            const oneHourAgo = Date.now() - 3600000

            processed = processed.filter(time => {
              return time > oneHourAgo
            })

            log(`🦕 [${message.seq}] processed ${message.manifest.name} in ${Date.now() - worker.updateStart}ms, ${(processed.length / 3600).toFixed(3)} modules/s`)

            emitter.emit('processed', message.manifest)
            emitter.emit('seq', message.seq)
          }

          callback()
        })

        worker.send({
          seq: data.seq,
          options,
          manifest: minimalManifest(data.json)
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
