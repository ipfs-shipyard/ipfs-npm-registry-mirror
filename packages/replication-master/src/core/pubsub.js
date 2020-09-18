'use strict'

const hat = require('hat')
const findBaseDir = require('ipfs-registry-mirror-common/utils/find-base-dir')
const log = require('ipfs-registry-mirror-common/utils/log')

const topic = `ipfs-registry-pubsub-${hat()}`
let lastBaseDir

const publishIpnsName = async (ipfs, baseDir) => {
  const previousBaseDir = lastBaseDir
  lastBaseDir = baseDir

  if (baseDir !== previousBaseDir) {
    log(`🗞️  Publishing IPNS update, base dir is /ipfs/${baseDir}`)

    await ipfs.name.publish(`/ipfs/${baseDir}`)

    log('📰 Published IPNS update')
  }
}

const publishUpdate = async (ipfs, baseDir) => {
  await ipfs.pubsub.publish(topic, Buffer.from(JSON.stringify({
    type: 'update',
    cid: baseDir
  })))

  log(`📰 Broadcast update of ${baseDir}`)
}

const master = async (config, ipfs, emitter) => {
  emitter.on('processed', async () => {
    const baseDir = await findBaseDir(ipfs, config)

    if (config.clone.publish) {
      try {
        await publishIpnsName(ipfs, baseDir)
      } catch (error) {
        log('💥 Error publishing IPNS name', error)
      }
    }

    try {
      await publishUpdate(ipfs, baseDir)
    } catch (error) {
      log('💥 Error publishing to topic', error)
    }
  })

  const root = await findBaseDir(ipfs, config)

  return {
    topic,
    root
  }
}

module.exports = master
