'use strict'

const follow = require('@achingbrain/follow-registry')
const debug = require('debug')('ipfs:registry-mirror:clone')
const saveManifest = require('ipfs-registry-mirror-common/utils/save-manifest')
const saveTarballs = require('./save-tarballs')
const sequenceFile = require('./sequence-file')
const log = require('ipfs-registry-mirror-common/utils/log')

let processed = []

const publishOrUpdateIPNSName = async (manifest, ipfs, options) => {
  let timer = Date.now()
  const file = `${options.ipfs.prefix}/${manifest.name}`
  let newNameCreated = false

  if (!manifest.ipns) {
    // we need to create the ipns name (which will be stable), add it to the
    // manifest, save it again and then immediately update the ipns name

    try {
      await ipfs.key.gen(manifest.name, {
        type: 'rsa',
        size: 2048
      })
    } catch (err) {
      if (!err.message.includes('already exists')) {
        throw err
      }
    }

    newNameCreated = true
  }

  const stats = await ipfs.files.stat(file)

  let result = await ipfs.name.publish(`/ipfs/${stats.hash}`, {
    key: manifest.name
  })

  if (newNameCreated) {
    manifest.ipns = result.name
    manifest = await saveManifest(manifest, ipfs, options)

    const stats = await ipfs.files.stat(file)
    await ipfs.name.publish(`/ipfs/${stats.hash}`, {
      key: manifest.name
    })
  }

  log(`💾 Updated ${manifest.name} IPNS name ${manifest.ipns} in ${Date.now() - timer}ms`)
}

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

        let manifest = data.json
        const mfsPath = `${options.ipfs.prefix}/${data.json.name}`

        let mfsVersion = {}
        let timer

        try {
          log(`📃 Reading ${data.json.name} cached manifest from ${mfsPath}`)
          timer = Date.now()
          mfsVersion = await ipfs.files.read(mfsPath)
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

          manifest = await saveManifest(manifest, ipfs, options)

          await publishOrUpdateIPNSName(manifest, ipfs, options)

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
