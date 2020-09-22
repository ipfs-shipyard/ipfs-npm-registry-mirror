'use strict'

const log = require('./log')

const findBaseDir = async (ipfs, config) => {
  try {
    const stats = await ipfs.files.stat(config.ipfs.prefix)

    log(`🌿 Root dir ${config.ipfs.prefix} is ${stats.cid}`)

    return stats.cid
  } catch (error) {
    if (error.message.includes('does not exist')) {
      log(`🐺 Creating base dir ${config.ipfs.prefix}`)

      await ipfs.files.mkdir(config.ipfs.prefix, {
        parents: true
      })
    }

    return findBaseDir(ipfs, config)
  }
}

module.exports = findBaseDir
