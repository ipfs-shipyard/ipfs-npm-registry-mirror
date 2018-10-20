'use strict'

const request = require('./retry-request')
const log = require('debug')('ipfs:registry-mirror:utils:load-manifest')
const saveManifest = require('./save-manifest')
const replaceTarballUrls = require('./replace-tarball-urls')
const timeout = require('./timeout-promise')

// the timeout after which we will fetch the manifest from npm instead
const READ_TIMEOUT = 10000

const loadManifest = async (config, ipfs, packageName, localOnly) => {
  let mfsVersion = {}
  let npmVersion = {}

  const mfsPath = `${config.ipfs.prefix}/${packageName}`
  const npmUrl = `${config.registry}/${packageName}`

  try {
    log(`Reading from mfs ${mfsPath}`)

    if (localOnly) {
      mfsVersion = JSON.parse(await ipfs.files.read(mfsPath))
    } else {
      mfsVersion = JSON.parse(await timeout(ipfs.files.read(mfsPath), READ_TIMEOUT))
    }

    log(`Read from mfs ${mfsPath}`)
  } catch (error) {
    if (error.code === 'ETIMEOUT') {
      log(`Timed out reading ${mfsPath}`)
    } else if (error.message.includes('file does not exist')) {
      log(`${mfsPath} not in MFS`)
    } else {
      log(`Could not read ${mfsPath}`, error)
    }

    if (localOnly) {
      throw error
    }
  }

  const modified = new Date((mfsVersion.time && mfsVersion.time.modified) || 0)
  const willDownload = (Date.now() - config.registryUpdateInterval) > modified.getTime()

  if (willDownload && !localOnly) {
    try {
      log(`Fetching ${npmUrl}`)
      const start = Date.now()
      npmVersion = await request(Object.assign({}, config.request, {
        uri: npmUrl,
        json: true
      }))
      log(`Fetched ${npmUrl} in ${Date.now() - start}ms`)
    } catch (error) {
      log(`Could not download ${npmUrl}`, error)
    }
  }

  if (!mfsVersion._rev && !npmVersion._rev) {
    throw new Error(`Not found, would have tried npm: ${willDownload}, local only: ${localOnly}`)
  }

  if (mfsVersion._rev && (!npmVersion._rev || npmVersion._rev === mfsVersion._rev)) {
    // we have a cached version and either fetching from npm failed or
    // our cached version matches the npm version
    return mfsVersion
  }

  console.info(`🆕 New version of ${packageName} detected`, mfsVersion._rev, 'vs', npmVersion._rev)

  npmVersion = replaceTarballUrls(config, npmVersion)

  // save our existing versions so we don't re-download tarballs we already have
  Object.keys(mfsVersion.versions || {}).forEach(versionNumber => {
    npmVersion.versions[versionNumber] = mfsVersion.versions[versionNumber]
  })

  // store it for next time
  await saveManifest(npmVersion, ipfs, config)

  return npmVersion
}

module.exports = loadManifest
