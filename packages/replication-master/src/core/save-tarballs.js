'use strict'

const debug = require('debug')('ipfs:registry-mirror:replicate:save-tarball')
const crypto = require('crypto')
const { default: PQueue } = require('p-queue')
const log = require('ipfs-registry-mirror-common/utils/log')
const { urlSource } = require('ipfs')

let queue

const saveTarball = async (packument, versionNumber, ipfs, options) => {
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

      await validateShasum(cid, shasum, url, ipfs, options)

      log(`🌍 Added ${url} to IPFS with CID ${cid} in ${Date.now() - start}ms`)

      return cid
    } catch (err) {
      log(`💥 Downloading tarballs failed`, err)
    }
  }

  throw new Error(`💥 ${options.request.retries} retries exceeded while downloading ${url}`)
}

const validateShasum = async (cid, shasum, url, ipfs, options) => {
  const hashStart = Date.now()
  const hash = crypto.createHash('sha1')
  hash.on('error', () => {})

  for await (const buf of ipfs.cat(cid, {
    signal: options.signal
  })) {
    hash.update(buf)
  }

  const result = hash.digest('hex')

  if (result !== shasum) {
    throw new Error(`Shasum of ${url} failed ${result} !== ${shasum}`)
  }

  log(`🙆 Checked shasum of ${url} in ${Date.now() - hashStart}ms`)
}

const saveTarballs = (packument, ipfs, options) => {
  if (!queue) {
    queue = new PQueue({ concurrency: options.request.concurrency })
  }

  return Promise.all(
    Object.keys(packument.versions || {})
      .map(versionNumber => {
        return queue.add(async () => {
          try {
            await saveTarball(packument, versionNumber, ipfs, options)
          } catch (err) {
            log(`💥 Error storing tarball ${packument.name} ${versionNumber}`, err)
          }
        })
      })
  )
}

module.exports = saveTarballs
