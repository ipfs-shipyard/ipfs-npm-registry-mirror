'use strict'

const follow = require('@achingbrain/follow-registry')
const debug = require('debug')('ipfs:registry-mirror:clone')
const replaceTarballUrls = require('ipfs-registry-mirror-common/utils/replace-tarball-urls')
const saveManifest = require('ipfs-registry-mirror-common/utils/save-manifest')
const saveTarballs = require('./save-tarballs')
const sequenceFile = require('./sequence-file')
const log = require('ipfs-registry-mirror-common/utils/log')

let processed = []

module.exports = async (emitter, ipfs, options) => {
  log(`🦎 Replicating registry with concurrency ${options.follow.concurrency}...`)

  return new Promise((resolve) => {
    follow(Object.assign({}, options.follow, {
      handler: async (data, callback) => {
        if (!data.json || !data.json.name) {
          return callback() // Bail, something is wrong with this change
        }

        log(`🎉 Updated version of ${data.json.name}`)
        const updateStart = Date.now()

        const manifest = replaceTarballUrls(options, data.json)
        const mfsPath = `${options.ipfs.prefix}/${data.json.name}`

        let mfsVersion = {}
        let timer

        try {
          log(`📃 Reading ${data.json.name} cached manifest from ${mfsPath}`)
          timer = Date.now()
          mfsVersion = JSON.parse(await ipfs.files.read(mfsPath))
          log(`📃 Read ${data.json.name} cached manifest from ${mfsPath} in ${Date.now() - timer}ms`)
        } catch (error) {
          if (error.message.includes('does not exist')) {
            debug(`${mfsPath} not in MFS`)
          } else {
            debug(`Could not read ${mfsPath}`, error)
          }
        }

        // save our existing versions so we don't re-download tarballs we already have
        Object.keys(mfsVersion.versions || {}).forEach(versionNumber => {
          manifest.versions[versionNumber] = mfsVersion.versions[versionNumber]
        })

        try {
          timer = Date.now()
          await saveTarballs(manifest, ipfs, options)
          log(`🧳 Saved ${data.json.name} tarballs in ${Date.now() - timer}ms`)

          await saveManifest(manifest, ipfs, options)

          processed.push(Date.now())
          const oneHourAgo = Date.now() - 3600000

          processed = processed.filter(time => {
            return time > oneHourAgo
          })

          log(`🦕 [${data.seq}] processed ${manifest.name} in ${Date.now() - updateStart}ms, ${(processed.length / 3600).toFixed(3)} modules/s`)

          emitter.emit('processed', manifest)
          emitter.emit('seq', data.seq)
        } catch (error) {
          debug(error)
          log(`💥 [${data.seq}] error processing ${manifest.name}`, error)
        }

        callback()
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
