'use strict'

const request = require('ipfs-registry-mirror-common/utils/retry-request')
const saveManifest = require('ipfs-registry-mirror-common/utils/save-manifest')
const findBaseDir = require('ipfs-registry-mirror-common/utils/find-base-dir')

const findMaster = async (config) => {
  return request(Object.assign({}, config.request, {
    uri: config.pubsub.master,
    json: true,
    retries: 100,
    retryDelay: 5000
  }))
}

const handleUpdate = async (config, ipfs, event) => {
  if (event.type !== 'update') {
    return
  }

  console.info('🦄 Incoming update for', event.manifest.name) // eslint-disable-line no-console

  try {
    await saveManifest(event.manifest, ipfs, config)
  } catch (error) {
    console.error(`💥 Could not update ${event.manifest.name} - ${error}`) // eslint-disable-line no-console
  }
}

const subscribeToTopic = async (config, ipfs, master) => {
  await ipfs.pubsub.subscribe(master.topic, (event) => {
    if (event.from !== master.ipfs.id) {
      return
    }

    try {
      handleUpdate(config, ipfs, JSON.parse(event.data.toString('utf8')))
    } catch (error) {
      console.error('💥 Error handling module update', error) // eslint-disable-line no-console
    }
  })
}

const updateRoot = async (config, ipfs, master) => {
  await findBaseDir(config, ipfs)

  return ipfs.files.cp(master.root, config.ipfs.prefix)

  // until js can resolve IPNS names remotely, just use the raw hash
  // const result = await ipfs.name.resolve(master.root)
  // console.info(`Importing ${result} as root`)
  // await ipfs.files.cp(result, config.ipfs.prefix)
}

const worker = async (config, ipfs) => {
  let timer = Date.now()
  const master = await findMaster(config)
  console.info(`🧚‍♀️ Found master id ${master.ipfs.id} in ${Date.now() - timer}ms`) // eslint-disable-line no-console

  timer = Date.now()
  await subscribeToTopic(config, ipfs, master)
  console.info(`🙋 Worker subscribed to ${master.topic} in ${Date.now() - timer}ms`) // eslint-disable-line no-console

  timer = Date.now()
  await updateRoot(config, ipfs, master)
  console.info(`🦓 Got root in ${Date.now() - timer}ms`) // eslint-disable-line no-console
}

module.exports = worker
