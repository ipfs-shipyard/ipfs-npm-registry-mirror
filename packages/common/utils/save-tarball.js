'use strict'

const request = require('./retry-request')
const crypto = require('crypto')
const loadPackument = require('./load-packument')
const savePackument = require('./save-packument')
const log = require('./log')

const saveTarball = async function (packageName, versionNumber, ipfs, config) {
  const packument = await loadPackument(packageName, ipfs, config)
  const version = packument.versions[versionNumber]

  validate(version, versionNumber, packageName)

  if (version.dist.cid) {
    log(`Skipping version ${versionNumber} of ${packageName} - already downloaded`)
    return
  }

  const startTime = Date.now()
  const cid = await downloadFile(version.dist.tarball, version.dist.shasum, ipfs, config)

  log(`🏄‍♀️ Added ${version.dist.tarball} with hash ${cid} in ${Date.now() - startTime}ms`)

  await updateCid(packageName, versionNumber, cid, ipfs, config)
}

const validate = (version, versionNumber, packageName) => {
  if (!version) {
    throw new Error(`Skipping invalid version ${versionNumber} of ${packageName} - version not in manifest`)
  }

  if (!version.dist) {
    throw new Error(`Skipping invalid version ${versionNumber} of ${packageName} - no dist section`)
  }

  if (!version.dist.shasum) {
    throw new Error(`Skipping invalid version ${versionNumber} of ${packageName} - no shasum`)
  }
}

const updateCid = async (packageName, versionNumber, cid, ipfs, config) => {
  const cidString = cid.toString('base32')

  while (true) {
    let packument = await loadPackument(packageName, ipfs, config)
    packument.versions[versionNumber].dist.cid = cidString

    await savePackument(packument, ipfs, config)

    packument = await loadPackument(packageName, ipfs, config)

    if (packument.versions[versionNumber].dist.cid === cidString) {
      return
    }

    log(`Manifest version cid ${packument.versions[versionNumber].dist.cid} did not equal ${cidString}`)
  }
}

const downloadFile = async (url, shasum, ipfs, config) => {
  log(`Downloading ${url}`)

  const hash = crypto.createHash('sha1')
  hash.setEncoding('hex')
  hash.on('error', () => {})

  const stream = await request(Object.assign({}, config.request, {
    uri: url
  }))
  stream.pipe(hash)

  const { cid } = await ipfs.add(stream, {
    wrapWithDirectory: false,
    pin: config.clone.pin,
    cidVersion: 1,
    rawLeaves: true
  })

  const result = hash.read()

  if (result !== shasum) {
    if (config.clone.pin) {
      // if we pinned the corrupt download, unpin it so it will get garbage collected later
      await ipfs.pin.rm(cid)
    }

    // we've already piped to the client at this point so can't retry the download
    // abort saving the CID of the corrupted download to our copy of the manifest
    // instead so we retry next time it's requested
    throw new Error(`File downloaded from ${url} had invalid shasum ${result} - expected ${shasum}`)
  }

  log(`File downloaded from ${url} had shasum ${result} - matched ${shasum}`)

  return cid
}

module.exports = saveTarball
