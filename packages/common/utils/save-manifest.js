'use strict'

const log = require('./log')

const saveManifest = async (pkg, ipfs, config) => {
  if (!pkg.name || pkg.error) {
    const error = pkg.error || new Error('No name found in package.json')

    throw error
  }

  const timer = Date.now()
  const file = `${config.ipfs.prefix}/${pkg.name}`

  await ipfs.files.write(file, Buffer.from(JSON.stringify(pkg)), {
    create: true,
    truncate: true,
    parents: true,
    flush: config.ipfs.flush
  })

  log(`💾 Saved ${pkg.name} manifest to ${file} in ${Date.now() - timer}ms`)
}

module.exports = saveManifest
