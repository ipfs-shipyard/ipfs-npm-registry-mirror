'use strict'

const log = require('debug')('ipfs:registry-mirror:replicate:save-tarball')
const request = require('ipfs-registry-mirror-common/utils/retry-request')
const CID = require('cids')
const crypto = require('crypto')
const loadManifest = require('ipfs-registry-mirror-common/utils/load-manifest')
const saveManifest = require('ipfs-registry-mirror-common/utils/save-manifest')
const {
  PassThrough
} = require('stream')

const saveTarball = async (manifest, versionNumber, ipfs, options) => {
  const version = manifest.versions[versionNumber]

  validate(version, versionNumber, manifest.name)

  if (version.dist.cid) {
    log(`Skipping version ${versionNumber} of ${manifest.name} - already downloaded`)

    return
  }

  const startTime = Date.now()
  const cid = await downloadFile(version.dist.source, version.dist.shasum, ipfs, options)

  version.dist.cid = cid

  console.info(`🏄‍♀️ Added ${version.dist.source} with hash ${cid} in ${Date.now() - startTime}ms`)
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
  log(`Downloading ${url}`)

  const hash = crypto.createHash('sha1')
  hash.setEncoding('hex')
  hash.on('error', () => {})

  return request(Object.assign({}, options.request, {
    uri: url
  }))
    .then(stream => {
      stream.pipe(hash)

      return ipfs.files.add(stream, {
        wrapWithDirectory: false
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

      log(`File downloaded from ${url} had shasum ${result} - matched ${shasum}`)

      const file = files.pop()

      return new CID(file.hash).toV1().toBaseEncodedString('base32')
    })
}

const saveTarballs = async (pkg, ipfs, options) => {
  return Promise.all(
    Object.keys(pkg.versions || {})
      .map(versionNumber => {
        return saveTarball(pkg, versionNumber, ipfs, options)
          .catch(error => {
            console.error(`💥 Error storing tarball ${pkg.name} ${versionNumber}`, error)
          })
      })
  )
}

module.exports = saveTarballs
