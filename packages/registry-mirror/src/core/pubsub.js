'use strict'

const request = require('ipfs-registry-mirror-common/utils/retry-request')
const log = require('ipfs-registry-mirror-common/utils/log')

const findMaster = (config) => {
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

  log('🦄 Incoming update')

  try {
    log(`🐴 Removing old ${config.ipfs.prefix}`)
    await ipfs.files.rm(config.ipfs.prefix, {
      recursive: true
    })
    log(`🐎 Copying /ipfs/${event.cid} to ${config.ipfs.prefix}`)
    await ipfs.files.cp(`/ipfs/${event.cid}`, config.ipfs.prefix)
  } catch (error) {
    log(`💥 Could not update ${event.module}`, error)
  }
}

const subscribeToTopic = async (config, ipfs, master) => {
  config.pubsub.topic = master.topic

  await ipfs.pubsub.subscribe(master.topic, (event) => {
    if (event.from !== master.ipfs.id) {
      return
    }

    try {
      handleUpdate(config, ipfs, JSON.parse(event.data.toString('utf8')))
    } catch (error) {
      log('💥 Error handling module update', error)
    }
  })
}

const updateRoot = (config, ipfs, master) => {
  return ipfs.files.cp(master.root, config.ipfs.prefix)
}

const worker = async (config, ipfs) => {
  let timer = Date.now()
  const master = await findMaster(config)
  log(`🧚‍♀️ Found master id ${master.ipfs.id} in ${Date.now() - timer}ms`)

  timer = Date.now()
  await subscribeToTopic(config, ipfs, master)
  log(`🙋 Worker subscribed to ${master.topic} in ${Date.now() - timer}ms`)

  timer = Date.now()
  await updateRoot(config, ipfs, master)
  log(`🦓 Got root in ${Date.now() - timer}ms`)
}

module.exports = worker
