'use strict'

const pkg = require('../../package')
const cluster = require('cluster')

process.title = `${pkg.name}-worker-${cluster.worker.id}`

const debug = require('debug')('ipfs:registry-mirror:clone')
const saveManifest = require('ipfs-registry-mirror-common/utils/save-manifest')
const saveTarballs = require('../core/save-tarballs')
const log = require('ipfs-registry-mirror-common/utils/log')
const getAnIPFS = require('ipfs-registry-mirror-common/utils/get-an-ipfs')
let ipfs

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

process.on('message', async ({ manifest, options, seq }) => {
  if (!ipfs) {
    ipfs = await getAnIPFS(options)
  }

  log(`🎉 Updated version of ${manifest.name}`)
  const mfsPath = `${options.ipfs.prefix}/${manifest.name}`

  let mfsVersion = {}
  let timer

  try {
    log(`📃 Reading ${manifest.name} cached manifest from ${mfsPath}`)
    timer = Date.now()
    mfsVersion = await ipfs.files.read(mfsPath)
    log(`📃 Read ${manifest.name} cached manifest from ${mfsPath} in ${Date.now() - timer}ms`)
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
    log(`🧳 Saved ${manifest.name} tarballs in ${Date.now() - timer}ms`)

    manifest = await saveManifest(manifest, ipfs, options)

    if (options.clone.publish) {
      await publishOrUpdateIPNSName(manifest, ipfs, options)
    }

    process.send({
      seq: seq,
      manifest
    })
  } catch (error) {
    process.send({
      seq: seq,
      manifest,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      }
    })
  }
})
