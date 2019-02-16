'use strict'

const log = require('./log')

const findBaseDir = async (config, ipfs) => {
  try {
    const stats = await ipfs.files.stat(config.ipfs.prefix, {
      hash: true
    })

    log(`🌿 Root dir ${config.ipfs.prefix} is ${stats.hash}`)

    return stats.hash
  } catch (error) {
    if (error.message.includes('does not exist')) {
      log('🐺 Creating base dir')

      await ipfs.files.mkdir(config.ipfs.prefix, {
        parents: true
      })
    }

    return findBaseDir(config, ipfs)
  }
}

module.exports = findBaseDir
