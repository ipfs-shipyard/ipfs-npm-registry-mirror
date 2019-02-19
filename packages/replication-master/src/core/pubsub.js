'use strict'

const hat = require('hat')
const findBaseDir = require('ipfs-registry-mirror-common/utils/find-base-dir')
const log = require('ipfs-registry-mirror-common/utils/log')

const topic = `ipfs-registry-pubsub-${hat()}`
let lastBaseDir

const publishIpnsName = async (config, ipfs) => {
  const baseDir = await findBaseDir(config, ipfs)
  let previousBaseDir = lastBaseDir
  lastBaseDir = baseDir

  if (baseDir !== previousBaseDir) {
    log(`🗞️  Publishing IPNS update, base dir is /ipfs/${baseDir}`)

    // No point until js-ipfs can resolve remote ipns names.  also seems to cause the process to hang.
    // await ipfs.name.publish(`/ipfs/${baseDir}

    log(`📰 Published IPNS update`)
  }
}

const publishUpdate = async (config, ipfs, pkg) => {
  await ipfs.pubsub.publish(topic, Buffer.from(JSON.stringify({
    type: 'update',
    manifest: pkg
  })))

  log(`📰 Broadcast update of ${pkg.name} module`)
}

const master = async (config, ipfs, emitter) => {
  emitter.on('processed', async (pkg) => {
    try {
      await publishIpnsName(config, ipfs)
    } catch (error) {
      log(`💥 Error publishing IPNS name`, error)
    }

    try {
      await publishUpdate(config, ipfs, pkg)
    } catch (error) {
      log('💥 Error publishing to topic', error)
    }
  })

  try {
    // so we don't lose connections to the mirrors
    await ipfs.pubsub.subscribe(topic, () => {})

    const root = await publishIpnsName(config, ipfs)

    return {
      topic,
      root
    }
  } catch (error) {
    throw error
  }
}

module.exports = master
