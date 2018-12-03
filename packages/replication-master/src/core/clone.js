'use strict'

const follow = require('@achingbrain/follow-registry')
const log = require('debug')('ipfs:registry-mirror:clone')
const replaceTarballUrls = require('ipfs-registry-mirror-common/utils/replace-tarball-urls')
const saveManifest = require('ipfs-registry-mirror-common/utils/save-manifest')
const saveTarballs = require('./save-tarballs')

let start = Date.now()
let processed = 0
const HALF_AN_HOUR = 1800000

module.exports = async (emitter, ipfs, options) => {
  console.info(`🦎 Replicating registry with concurrency ${options.follow.concurrency}...`) // eslint-disable-line no-console

  let lastUpdate = 0

  setInterval(() => {
    if (Date.now() - lastUpdate > HALF_AN_HOUR) {
      throw new Error('💥 Did not receive an update for 30 minutes, restarting')
    }
  }, HALF_AN_HOUR)

  return new Promise((resolve) => {
    follow(Object.assign({}, options.follow, {
      handler: async (data, callback) => {
        if (!data.json || !data.json.name) {
          return callback() // Bail, something is wrong with this change
        }

        lastUpdate = Date.now()

        console.info(`🎉 Updated version of ${data.json.name}`) // eslint-disable-line no-console
        const updateStart = Date.now()

        const manifest = replaceTarballUrls(options, data.json)
        const mfsPath = `${options.ipfs.prefix}/${data.json.name}`

        let mfsVersion = {}
        let timer

        try {
          console.info(`📃 Reading ${data.json.name} cached manifest from ${mfsPath}`) // eslint-disable-line no-console
          timer = Date.now()
          mfsVersion = JSON.parse(await ipfs.files.read(mfsPath))
          console.info(`📃 Read ${data.json.name} cached manifest from ${mfsPath} in ${Date.now() - timer}ms`) // eslint-disable-line no-console
        } catch (error) {
          if (error.message.includes('does not exist')) {
            log(`${mfsPath} not in MFS`)
          } else {
            log(`Could not read ${mfsPath}`, error)
          }
        }

        // save our existing versions so we don't re-download tarballs we already have
        Object.keys(mfsVersion.versions || {}).forEach(versionNumber => {
          manifest.versions[versionNumber] = mfsVersion.versions[versionNumber]
        })

        try {
          timer = Date.now()
          await saveTarballs(manifest, ipfs, options)
          console.info(`🧳 Saved ${data.json.name} tarballs in ${Date.now() - timer}ms`) // eslint-disable-line no-console
          timer = Date.now()
          await saveManifest(manifest, ipfs, options)
          console.info(`💾 Saved ${data.json.name} manifest in ${Date.now() - timer}ms`) // eslint-disable-line no-console

          processed++
          console.info(`🦕 [${data.seq}] processed ${manifest.name} in ${Date.now() - updateStart}ms, ${(processed / ((Date.now() - start) / 1000)).toFixed(3)} modules/s`) // eslint-disable-line no-console

          emitter.emit('processed', manifest)
          emitter.emit('seq', data.seq)
        } catch (error) {
          log(error)
          console.error(`💥 [${data.seq}] error processing ${manifest.name} - ${error}`) // eslint-disable-line no-console
        }

        callback()
      }
    }), (stream) => {
      resolve(stream)
    })
  })
}
