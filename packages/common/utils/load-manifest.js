'use strict'

const request = require('./retry-request')
const debug = require('debug')('ipfs:registry-mirror:utils:load-manifest')
const saveManifest = require('./save-manifest')
const timeout = require('./timeout-promise')
const log = require('./log')

const hasBackupRegistry = (options) => {
  return options.npm && options.npm.registry
}

const loadFromMfs = async (packageName, ipfs, options) => {
  let json = {}
  const mfsPath = `${options.ipfs.prefix}/${packageName}`

  try {
    debug(`Reading from mfs ${mfsPath}`)
    const start = Date.now()

    const stat = await ipfs.files.stat(mfsPath)
    json = await ipfs.dag.get(stat.hash)
    json = json.value

    debug(`Read from mfs ${mfsPath} in ${Date.now() - start}ms`)
  } catch (error) {
    if (error.code === 'ERR_NOT_FOUND') {
      debug(`${mfsPath} not in MFS`)
    }

    debug(`Could not read ${mfsPath}`, error)
  }

  return json
}

const requestFromRegistry = async (packageName, registry, ipfs, options) => {
  let json = {}
  const uri = `${registry}/${packageName}`

  try {
    debug(`Fetching ${uri}`)
    const start = Date.now()

    json = await request(Object.assign({}, options.request, {
      uri,
      json: true
    }))

    debug(`Fetched ${uri} in ${Date.now() - start}ms`)
  } catch (error) {
    debug(`Could not download ${uri}`, error)
  }

  return json
}

const loadFromMainRegistry = (packageName, ipfs, options) => {
  if (options.registry) {
    return requestFromRegistry(packageName, options.registry, ipfs, options)
  }

  return {}
}

const loadFromBackupRegistry = (packageName, ipfs, options) => {
  if (options.npm && options.npm.registry) {
    return requestFromRegistry(packageName, options.npm.registry, ipfs, options)
  }

  return {}
}

const loadFromRegistry = async (packageName, ipfs, options) => {
  if (hasBackupRegistry(options)) {
    let result

    try {
      result = await timeout(loadFromMainRegistry(packageName, ipfs, options), options.registryReadTimeout)
    } catch (error) {
      if (error.code === 'ETIMEOUT') {
        debug(`Fetching ${packageName} timed out after ${options.registryReadTimeout}ms`)
      }
    }

    if (result && result._rev) {
      return result
    }

    try {
      return await loadFromBackupRegistry(packageName, ipfs, options)
    } catch (error) {
      debug(`Could not download ${uri}`, error)
    }

    return {}
  } else {
    return loadFromMainRegistry(packageName, ipfs, options)
  }
}

const findNewVersions = (cached, upstream) => {
  const cachedVersions = cached.versions || {}
  const upstreamVersions = upstream.versions || {}

  return Object.keys(upstreamVersions)
    .filter(version => !cachedVersions[version])
}

const loadManifest = async (options, ipfs, packageName) => {
  let mfsVersion = await loadFromMfs(packageName, ipfs, options)
  let registryVersion = {}

  const modified = new Date(mfsVersion.updated || 0)
  const willDownload = (Date.now() - options.registryUpdateInterval) > modified.getTime()

  if (willDownload) {
    registryVersion = await loadFromRegistry(packageName, ipfs, options)
  }

  if (!mfsVersion.versions && !registryVersion.versions) {
    throw new Error(`${packageName} not found, tried upstream registry: ${willDownload}`)
  }

  const newVerisons = findNewVersions(mfsVersion, registryVersion)

  if (!newVerisons.length) {
    // we have a cached version and either fetching from npm failed or
    // our cached version matches the npm version
    return mfsVersion
  }

  log(`🆕 New version${newVerisons.length > 1 ? 's': ''} of ${packageName} detected - ${newVerisons.join(', ')}`)

  // save our existing versions so we don't re-download tarballs we already have
  Object.keys(mfsVersion.versions || {}).forEach(versionNumber => {
    registryVersion.versions[versionNumber] = mfsVersion.versions[versionNumber]
  })

  // store it for next time
  return saveManifest(registryVersion, ipfs, options)
}

module.exports = loadManifest
