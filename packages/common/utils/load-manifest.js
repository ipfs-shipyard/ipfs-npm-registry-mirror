'use strict'

const request = require('./retry-request')
const log = require('debug')('ipfs:registry-mirror:utils:load-manifest')
const saveManifest = require('./save-manifest')
const replaceTarballUrls = require('./replace-tarball-urls')
const timeout = require('./timeout-promise')

const hasBackupRegistry = (options) => {
  return options.npm && options.npm.registry
}

const loadFromMfs = async (packageName, ipfs, options) => {
  let json = {}
  const mfsPath = `${options.ipfs.prefix}/${packageName}`

  try {
    log(`Reading from mfs ${mfsPath}`)
    const start = Date.now()

    json = await ipfs.files.read(mfsPath)

    log(`Read from mfs ${mfsPath} in ${Date.now() - start}ms`)

    json = JSON.parse(json)
  } catch (error) {
    if (error.message.includes('file does not exist')) {
      log(`${mfsPath} not in MFS`)
    }

    log(`Could not read ${mfsPath}`, error)
  }

  return json
}

const requestFromRegistry = async (packageName, registry, ipfs, options) => {
  let json = {}
  const uri = `${registry}/${packageName}`

  try {
    log(`Fetching ${uri}`)
    const start = Date.now()

    json = await request(Object.assign({}, options.request, {
      uri,
      json: true
    }))

    log(`Fetched ${uri} in ${Date.now() - start}ms`)
  } catch (error) {
    log(`Could not download ${uri}`, error)
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
        log(`Fetching ${packageName} timed out after ${options.registryReadTimeout}ms`)
      }
    }

    if (result && result._rev) {
      return result
    }

    try {
      return await loadFromBackupRegistry(packageName, ipfs, options)
    } catch (error) {
      log(`Could not download ${uri}`, error)
    }

    return {}
  } else {
    return loadFromMainRegistry(packageName, ipfs, options)
  }
}

const loadManifest = async (options, ipfs, packageName) => {
  let mfsVersion = await loadFromMfs(packageName, ipfs, options)
  let registryVersion = {}

  const modified = new Date((mfsVersion.time && mfsVersion.time.modified) || 0)
  const willDownload = (Date.now() - options.registryUpdateInterval) > modified.getTime()

  if (willDownload) {
    registryVersion = await loadFromRegistry(packageName, ipfs, options)
  }

  if (!mfsVersion._rev && !registryVersion._rev) {
    throw new Error(`${packageName} not found, tried upstream registry: ${willDownload}`)
  }

  if (mfsVersion._rev && (!registryVersion._rev || registryVersion._rev === mfsVersion._rev)) {
    // we have a cached version and either fetching from npm failed or
    // our cached version matches the npm version
    return mfsVersion
  }

  console.info(`🆕 New version of ${packageName} detected`, mfsVersion._rev, 'vs', registryVersion._rev)

  registryVersion = replaceTarballUrls(options, registryVersion)

  // save our existing versions so we don't re-download tarballs we already have
  Object.keys(mfsVersion.versions || {}).forEach(versionNumber => {
    registryVersion.versions[versionNumber] = mfsVersion.versions[versionNumber]
  })

  // store it for next time
  await saveManifest(registryVersion, ipfs, options)

  return registryVersion
}

module.exports = loadManifest
