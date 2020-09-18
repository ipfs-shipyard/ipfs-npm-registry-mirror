'use strict'

const savePackument = async (packument, ipfs, config) => {
  if (!packument.name) {
    throw new Error('No name found in packument')
  }

  let lastErr

  for (let i = 0; i < 5; i++) {
    try {
      const file = `${config.ipfs.prefix}/${packument.name}`

      await ipfs.files.write(file, JSON.stringify(packument, null, 2), {
        truncate: true,
        parents: true,
        create: true,
        cidVersion: 1,
        rawLeaves: true
      })

      return
    } catch (err) {
      lastErr = err
    }
  }

  throw lastErr
}

module.exports = savePackument
