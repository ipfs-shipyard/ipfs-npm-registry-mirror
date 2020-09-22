'use strict'

const request = require('./retry-request')
const debug = require('debug')('ipfs:registry-mirror:utils:load-packument')
const savePackument = require('./save-packument')
const timeout = require('./timeout-promise')
const log = require('./log')
const toBuffer = require('it-to-buffer')

const loadFromMfs = async (packageName, ipfs, options) => {
  const mfsPath = `${options.ipfs.prefix}/${packageName}`

  try {
    const start = Date.now()

    debug(`Reading from mfs ${mfsPath}`)

    const buf = await toBuffer(ipfs.files.read(mfsPath))

    debug(`Read from mfs ${mfsPath} in ${Date.now() - start}ms`)

    return JSON.parse(buf.toString('utf8'))
  } catch (error) {
    if (error.code === 'ERR_NOT_FOUND') {
      debug(`${mfsPath} not in MFS`)
    }

    debug(`Could not read ${mfsPath}`, error)
  }
}

const requestFromRegistry = async (packageName, registry, options) => {
  const uri = `${registry}/${packageName}`

  try {
    debug(`Fetching ${uri}`)
    const start = Date.now()
    const json = await request(Object.assign({}, options.request, {
      uri,
      json: true
    }))

    debug(`Fetched ${uri} in ${Date.now() - start}ms`)

    return json
  } catch (error) {
    debug(`Could not download ${uri}`, error)
  }
}

const loadFromRegistry = async (packageName, ipfs, options) => {
  for (const registry of options.registries) {
    let result

    try {
      result = await timeout(requestFromRegistry(packageName, registry, options), options.registryReadTimeout)
    } catch (error) {
      if (error.code === 'ETIMEOUT') {
        debug(`Fetching ${packageName} timed out after ${options.registryReadTimeout}ms`)
      }
    }

    if (result) {
      return result
    }
  }
}

const findNewVersions = (cached, upstream) => {
  const cachedVersions = (cached && cached.versions) || {}
  const upstreamVersions = (upstream && upstream.versions) || {}

  return Object.keys(upstreamVersions)
    .filter(version => !cachedVersions[version])
}

const loadPackument = async (packageName, ipfs, options) => {
  const mfsVersion = await loadFromMfs(packageName, ipfs, options)
  let registryVersion
  let willDownload = true

  if (mfsVersion) {
    const modified = new Date(mfsVersion.updated || 0)
    willDownload = (Date.now() - options.registryUpdateInterval) > modified.getTime()
  }

  if (willDownload) {
    registryVersion = await loadFromRegistry(packageName, ipfs, options)
  }

  if (!mfsVersion && !registryVersion) {
    throw new Error(`${packageName} not found, tried upstream registry: ${willDownload}`)
  }

  const newVerisons = findNewVersions(mfsVersion, registryVersion)

  if (mfsVersion && !newVerisons.length) {
    // we have a cached version and either fetching from npm failed or
    // our cached version matches the npm version
    return mfsVersion
  }

  if (newVerisons.length) {
    log(`🆕 New version${newVerisons.length > 1 ? 's' : ''} of ${packageName} detected - ${newVerisons.join(', ')}`)
  }

  // save our existing versions so we don't re-download tarballs we already have
  if (mfsVersion) {
    Object.keys(mfsVersion.versions || {}).forEach(versionNumber => {
      registryVersion.versions[versionNumber] = mfsVersion.versions[versionNumber]
    })
  }

  // store it for next time
  await savePackument(registryVersion, ipfs, options)

  return registryVersion
}

module.exports = loadPackument
