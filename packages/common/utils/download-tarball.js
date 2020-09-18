'use strict'

const debug = require('debug')('ipfs:registry-common:utils:download-tarball')
const crypto = require('crypto')
const log = require('ipfs-registry-mirror-common/utils/log')
const { urlSource } = require('ipfs')

const downloadTarball = async (packument, versionNumber, ipfs, options) => {
  const version = packument.versions[versionNumber]

  validate(version, versionNumber, packument.name)

  if (version.cid) {
    debug(`Skipping version ${versionNumber} of ${packument.name} - already downloaded`)

    return
  }

  const start = Date.now()

  const cid = await downloadFile(version.dist.tarball, version.dist.shasum, ipfs, options)

  version.cid = `/ipfs/${cid}`

  log(`🏄‍♀️ Added ${version.tarball} with CID ${version.cid} in ${Date.now() - start}ms`)
}

const validate = (version, versionNumber, packageName) => {
  if (!version) {
    throw new Error(`Skipping invalid version ${versionNumber} of ${packageName} - version not in manifest`)
  }

  if (!version.dist) {
    throw new Error(`Skipping invalid version ${versionNumber} of ${packageName} - no dist section`)
  }

  if (!version.dist.tarball) {
    throw new Error(`Skipping invalid version ${versionNumber} of ${packageName} - no tarball`)
  }

  if (!version.dist.shasum) {
    throw new Error(`Skipping invalid version ${versionNumber} of ${packageName} - no shasum`)
  }
}

const downloadFile = async (url, shasum, ipfs, options) => {
  for (let i = 0; i < options.request.retries; i++) {
    try {
      log(`⬇️  Downloading ${url}`)
      const start = Date.now()

      const {
        cid
      } = await ipfs.add(urlSource(url), {
        wrapWithDirectory: false,
        pin: options.clone.pin,
        version: 1,
        rawLeaves: true
      })

      log(`✅ Downloaded ${url} in ${Date.now() - start}ms`)

      await validateShasum(cid, shasum, url, ipfs)

      log(`🌍 Added ${url} to IPFS with CID ${cid} in ${Date.now() - start}ms`)

      return cid
    } catch (err) {
      log(`💥 Download failed: ${err.message}`)
    }
  }

  throw new Error(`💥 ${options.request.retries} retries exceeded while downloading ${url}`)
}

const validateShasum = async (cid, shasum, url, ipfs) => {
  const hashStart = Date.now()
  const hash = crypto.createHash('sha1')
  hash.on('error', () => {})

  for await (const buf of ipfs.cat(cid)) {
    hash.update(buf)
  }

  const result = hash.digest('hex')

  if (result !== shasum) {
    throw new Error(`Shasum of ${url} failed ${result} !== ${shasum}`)
  }

  log(`🙆 Checked shasum of ${url} in ${Date.now() - hashStart}ms`)
}

module.exports = downloadTarball
