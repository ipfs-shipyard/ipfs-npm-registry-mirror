'use strict'

const saveTarball = require('ipfs-registry-mirror-common/utils/save-tarball')

const saveTarballs = async (config, pkg, ipfs) => {
  return Promise.all(
    Object.keys(pkg.versions || {})
      .map(versionNumber => {
        return new Promise((resolve, reject) => {
          const stream = saveTarball(config, pkg.name, versionNumber, ipfs, true, (error) => {
            if (error) {
              return reject(error)
            }

            resolve()
          })
          stream.once('error', (error) => reject(error))
          stream.on('data', () => {})
        })
      })
  )
}

module.exports = saveTarballs
