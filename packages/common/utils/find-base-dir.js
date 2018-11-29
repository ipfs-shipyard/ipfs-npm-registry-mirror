'use strict'

const findBaseDir = async (config, ipfs) => {
  try {
    const stats = await ipfs.files.stat(config.ipfs.prefix, {
      hash: true
    })

    return stats.hash
  } catch (error) {
    if (error.message.includes('does not exist')) {
      console.info('🐺 Creating base dir') // eslint-disable-line no-console

      await ipfs.files.mkdir(config.ipfs.prefix, {
        parents: true
      })
    }

    return findBaseDir(config, ipfs)
  }
}

module.exports = findBaseDir
