'use strict'

const log = require('./log')

const saveManifest = async (pkg, ipfs, config) => {
  if (!pkg.name || pkg.error) {
    const error = pkg.error || new Error('No name found in package.json')

    throw error
  }

  const timer = Date.now()
  const file = `${config.ipfs.prefix}/${pkg.name}`
  const versions = {}

  Object.keys(pkg.versions).forEach(version => {
    versions[version] = {
      name: pkg.versions[version].name,
      version: pkg.versions[version].version,
      dependencies: pkg.versions[version].dependencies,
      devDependencies: pkg.versions[version].devDependencies,
      optionalDependencies: pkg.versions[version].optionalDependencies,
      peerDependencies: pkg.versions[version].peerDependencies,
      bundledDependencies: pkg.versions[version].bundledDependencies,
      directories: pkg.versions[version].directories,
      dist: pkg.versions[version].dist
    }
  })

  const packument = {
    name: pkg.name,
    ipns: pkg.ipns,
    updated: new Date(),
    time: pkg.time,
    'dist-tags': pkg['dist-tags'],
    versions
  }

  const cid = await ipfs.dag.put(packument, {
    format: 'dag-cbor',
    hashAlg: 'sha2-256'
  })

  try {
    await ipfs.files.rm(file)
  } catch (err) {
    if (err.code !== 'ERR_NOT_FOUND') {
      console.info('could not delete', file)
      console.info(err)
    }
  }

  try {
    await ipfs.files.mkdir(config.ipfs.prefix, {
      parents: true
    })
  } catch (err) {
    console.info(err)
  }

  await ipfs.files.cp(`/ipfs/${cid}`, file, {
    parents: true
  })

  log(`💾 Saved ${pkg.name} manifest to ${file} in ${Date.now() - timer}ms`)

  return packument
}

module.exports = saveManifest
