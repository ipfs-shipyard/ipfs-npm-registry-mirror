'use strict'

const saveTarball = require('./save-tarball')
const CID = require('cids')
const loadPackument = require('./load-packument')

const readOrDownloadTarball = async function * (path, ipfs, config) {
  const {
    packageName,
    packageVersion
  } = extractPackageDetails(path)

  let packument = await loadPackument(packageName, ipfs, config)
  let version = packument.versions[packageVersion]

  if (!version) {
    throw new Error(`Could not find version ${packageName}@${packageVersion} in available versions ${Object.keys(packument.versions)}`)
  }

  if (!version.dist.cid) {
    await saveTarball(packument.name, packageVersion, ipfs, config)

    packument = await loadPackument(packageName, ipfs, config)
    version = packument.versions[packageVersion]

    if (!version.dist.cid) {
      throw new Error(`CID for ${packageName}@${packageVersion} missing after download`)
    }
  }

  yield * ipfs.cat(new CID(version.dist.cid))
}

const extractPackageDetails = (path) => {
  let [
    packageName, fileName
  ] = path.split('/-/')

  if (packageName.startsWith('/')) {
    packageName = packageName.substring(1)
  }

  let moduleName = packageName

  if (packageName.startsWith('@')) {
    moduleName = packageName.split('/').pop()
  }

  const packageVersion = fileName.substring(moduleName.length + 1, fileName.length - 4)

  return {
    packageName,
    packageVersion
  }
}

module.exports = readOrDownloadTarball
