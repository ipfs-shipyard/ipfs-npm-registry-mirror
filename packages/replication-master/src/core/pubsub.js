'use strict'

const hat = require('hat')
const findBaseDir = require('ipfs-registry-mirror-common/utils/find-base-dir')

const topic = `ipfs-registry-pubsub-${hat()}`
let lastBaseDir

const publishIpnsName = async (config, ipfs) => {
  const baseDir = await findBaseDir(config, ipfs)
  let previousBaseDir = lastBaseDir
  lastBaseDir = baseDir

  if (baseDir !== previousBaseDir) {
    console.info(`🗞️  Publishing IPNS update, base dir is /ipfs/${baseDir}`) // eslint-disable-line no-console

    // No point until js-ipfs can resolve remote ipns names.  also seems to cause the process to hang.
    // await ipfs.name.publish(`/ipfs/${baseDir}

    console.info(`📰 Published IPNS update`) // eslint-disable-line no-console
  }
}

const publishUpdate = async (config, ipfs, pkg) => {
  await ipfs.pubsub.publish(topic, Buffer.from(JSON.stringify({
    type: 'update',
    manifest: pkg
  })))

  console.info(`📰 Broadcast update of ${pkg.name} module`) // eslint-disable-line no-console
}

const master = async (config, ipfs, emitter) => {
  emitter.on('processed', async (pkg) => {
    try {
      await publishIpnsName(config, ipfs)
    } catch (error) {
      console.error(`💥 Error publishing IPNS name - ${error}`) // eslint-disable-line no-console
    }

    try {
      await publishUpdate(config, ipfs, pkg)
    } catch (error) {
      console.error('💥 Error publishing to topic', error) // eslint-disable-line no-console
    }
  })

  try {
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
