'use strict'

const debug = require('debug')('ipfs:registry-mirror:replicate:save-tarball')
const request = require('ipfs-registry-mirror-common/utils/retry-request')
const CID = require('cids')
const crypto = require('crypto')
const PQueue = require('p-queue')
const log = require('ipfs-registry-mirror-common/utils/log')

let queue

const saveTarball = async (manifest, versionNumber, ipfs, options) => {
  const version = manifest.versions[versionNumber]

  validate(version, versionNumber, manifest.name)

  if (version.dist.cid) {
    debug(`Skipping version ${versionNumber} of ${manifest.name} - already downloaded`)

    return
  }

  const startTime = Date.now()
  const cid = await downloadFile(version.dist.source, version.dist.shasum, ipfs, options)

  version.dist.cid = cid

  log(`🏄‍♀️ Added ${version.dist.source} with hash ${cid} in ${Date.now() - startTime}ms`)
}

const validate = (version, versionNumber, packageName) => {
  if (!version) {
    throw new Error(`Skipping invalid version ${versionNumber} of ${packageName} - version not in manifest`)
  }

  if (!version.dist) {
    throw new Error(`Skipping invalid version ${versionNumber} of ${packageName} - no dist section`)
  }

  if (!version.dist.source) {
    throw new Error(`Skipping invalid version ${versionNumber} of ${packageName} - no source`)
  }

  if (!version.dist.shasum) {
    throw new Error(`Skipping invalid version ${versionNumber} of ${packageName} - no shasum`)
  }
}

const downloadFile = async (url, shasum, ipfs, options) => {
  log(`⬇️  Downloading ${url}`)
  const start = Date.now()

  const hash = crypto.createHash('sha1')
  hash.setEncoding('hex')
  hash.on('error', () => {})

  return request(Object.assign({}, options.request, {
    uri: url
  }))
    .then(stream => {
      stream.pipe(hash)

      stream.once('end', () => {
        log(`✅ Downloaded ${url} in ${Date.now() - start}ms`)
      })

      return ipfs.add(stream, {
        wrapWithDirectory: false,
        pin: options.clone.pin
      })
    })
    .then(files => {
      const result = hash.read()

      if (result !== shasum) {
        // we've already piped to the client at this point so can't retry the download
        // abort saving the CID of the corrupted download to our copy of the manifest
        // instead so we retry next time it's requested
        throw new Error(`File downloaded from ${url} had invalid shasum ${result} - expected ${shasum}`)
      }

      log(`🌍 Added ${url} to IPFS in ${Date.now() - start}ms`)

      const file = files.pop()

      return new CID(file.hash).toV1().toBaseEncodedString('base32')
    })
}

const saveTarballs = async (pkg, ipfs, options) => {
  if (!queue) {
    queue = new PQueue({ concurrency: options.request.concurrency })
  }

  return Promise.all(
    Object.keys(pkg.versions || {})
      .map(versionNumber => {
        return queue.add(async () => {
          try {
            await saveTarball(pkg, versionNumber, ipfs, options)
          } catch (err) {
            log(`💥 Error storing tarball ${pkg.name} ${versionNumber}`, err)
          }
        })
      })
  )
}

module.exports = saveTarballs
