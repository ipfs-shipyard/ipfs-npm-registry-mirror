'use strict'

const hat = require('hat')
const findBaseDir = require('ipfs-registry-mirror-common/utils/find-base-dir')
const log = require('ipfs-registry-mirror-common/utils/log')

const topic = `ipfs-registry-pubsub-${hat()}`
let lastBaseDir

const publishIpnsName = async (ipfs, cid) => {
  if (cid.toString() !== lastBaseDir.toString()) {
    lastBaseDir = cid

    log(`🗞️  Publishing IPNS update, base dir is /ipfs/${cid}`)

    await ipfs.name.publish(`/ipfs/${cid}`)

    log('📰 Published IPNS update')
  }
}

const publishUpdate = async (ipfs, cid) => {
  await ipfs.pubsub.publish(topic, Buffer.from(JSON.stringify({
    type: 'update',
    cid: cid.toString()
  })))

  log(`📰 Broadcast update of ${cid}`)
}

const master = async (config, ipfs, emitter) => {
  emitter.on('processed', async () => {
    const cid = await findBaseDir(ipfs, config)

    if (config.clone.publish) {
      try {
        await publishIpnsName(ipfs, cid)
      } catch (error) {
        log('💥 Error publishing IPNS name', error)
      }
    }

    try {
      await publishUpdate(ipfs, cid)
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
