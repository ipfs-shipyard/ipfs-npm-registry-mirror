'use strict'

const pkg = require('../../package')
const cluster = require('cluster')

process.title = `${pkg.name}-worker-${cluster.worker.id}`

const debug = require('debug')('ipfs:registry-mirror:clone')
const savePackument = require('ipfs-registry-mirror-common/utils/save-packument')
const saveTarballs = require('../core/save-tarballs')
const log = require('ipfs-registry-mirror-common/utils/log')
const getAnIPFS = require('ipfs-registry-mirror-common/utils/get-an-ipfs')
let ipfs

const publishOrUpdateIPNSName = async (packument, ipfs, options) => {
  const timer = Date.now()
  const file = `${options.ipfs.prefix}/${packument.name}`
  let newNameCreated = false

  if (!packument.ipns) {
    // we need to create the ipns name (which will be stable), add it to the
    // manifest, save it again and then immediately update the ipns name

    try {
      await ipfs.key.gen(packument.name, {
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

  const result = await ipfs.name.publish(`/ipfs/${stats.hash}`, {
    key: packument.name
  })

  if (newNameCreated) {
    packument.ipns = result.name
    packument = await savePackument(packument, ipfs, options)

    const stats = await ipfs.files.stat(file)
    await ipfs.name.publish(`/ipfs/${stats.hash}`, {
      key: packument.name
    })
  }

  log(`💾 Updated ${packument.name} IPNS name ${packument.ipns} in ${Date.now() - timer}ms`)
}

process.on('message', async ({ packument, seq, options }) => {
  if (!ipfs) {
    ipfs = await getAnIPFS(options)
  }

  log(`🎉 Updated version of ${packument.name}`)
  const mfsPath = `${options.ipfs.prefix}/${packument.name}`
  let mfsVersion = {
    versions: {}
  }
  let timer

  try {
    log(`📃 Reading ${packument.name} cached packument from ${mfsPath}`)
    timer = Date.now()
    mfsVersion = await ipfs.files.read(mfsPath)
    log(`📃 Read ${packument.name} cached packument from ${mfsPath} in ${Date.now() - timer}ms`)
  } catch (error) {
    if (error.message.includes('does not exist')) {
      debug(`${mfsPath} not in MFS`)
    } else {
      debug(`Could not read ${mfsPath}`, error)
    }
  }

  // save our existing versions so we don't re-download tarballs we already have
  Object.keys(mfsVersion.versions || {}).forEach(versionNumber => {
    packument.versions[versionNumber] = mfsVersion.versions[versionNumber]
  })

  packument.ipns = mfsVersion.ipns

  try {
    timer = Date.now()
    await saveTarballs(packument, ipfs, options)
    log(`🧳 Saved ${packument.name} tarballs in ${Date.now() - timer}ms`)

    timer = Date.now()
    await savePackument(packument, ipfs, options)
    log(`💾 Saved ${packument.name} packument in ${Date.now() - timer}ms`)

    if (options.clone.publish) {
      await publishOrUpdateIPNSName(packument, ipfs, options)
    }

    process.send({
      seq,
      name: packument.name
    })
  } catch (error) {
    process.send({
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
