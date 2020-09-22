'use strict'

const getExternalUrl = require('./get-external-url')

const replaceTarballUrls = (pkg, config) => {
  const prefix = getExternalUrl(config)
  const packageName = pkg.name
  const moduleName = packageName.startsWith('@') ? packageName.split('/').pop() : packageName

  // change tarball URLs to point to us
  Object.keys(pkg.versions || {})
    .forEach(versionNumber => {
      const version = pkg.versions[versionNumber]

      if (version.dist.source) {
        return
      }

      version.dist.source = version.dist.tarball
      version.dist.tarball = `${prefix}/${packageName}/-/${moduleName}-${versionNumber}.tgz`
    })

  return pkg
}

module.exports = replaceTarballUrls
