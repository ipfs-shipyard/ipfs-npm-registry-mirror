'use strict'

const follow = require('@achingbrain/follow-registry')
const log = require('debug')('ipfs:registry-mirror:clone')
const replaceTarballUrls = require('ipfs-registry-mirror-common/utils/replace-tarball-urls')
const saveManifest = require('ipfs-registry-mirror-common/utils/save-manifest')
const saveTarballs = require('./save-tarballs')

let start = Date.now()
let processed = 0

module.exports = async (emitter, ipfs, options) => {
  console.info('🦎 Replicating registry...') // eslint-disable-line no-console

  return new Promise((resolve) => {
    follow(Object.assign({}, options.follow, {
      handler: async (data, callback) => {
        if (!data.json || !data.json.name) {
          return callback() // Bail, something is wrong with this change
        }

        console.info(`🎉 Updated version of ${data.json.name}`) // eslint-disable-line no-console
        const updateStart = Date.now()

        const manifest = replaceTarballUrls(options, data.json)
        const mfsPath = `${options.ipfs.prefix}/${data.json.name}`

        let mfsVersion = {}

        try {
          mfsVersion = JSON.parse(await ipfs.files.read(mfsPath))
          log(`Read cached manifest from ${mfsPath}`)
        } catch (error) {
          if (error.message.includes('file does not exist')) {
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
          await saveTarballs(manifest, ipfs, options)
          await saveManifest(manifest, ipfs, options)

          let updateEnd = Date.now()
          processed++
          console.log(`🦕 [${data.seq}] processed ${manifest.name} in ${Math.round((updateEnd - updateStart) / 1000)}s, ${(processed / ((Date.now() - start) / 1000)).toFixed(3)} modules/s`) // eslint-disable-line no-console

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
