'use strict'

const proxy = require('express-http-proxy')
const config = require('./config')
const replicationWorker = require('./pubsub')
const getExternalUrl = require('ipfs-registry-mirror-common/utils/get-external-url')
const server = require('ipfs-registry-mirror-common/server')
const tarball = require('./tarball')
const manifest = require('./manifest')
const root = require('./root')
const request = require('ipfs-registry-mirror-common/utils/retry-request')
const findExternalPort = require('./find-external-port')

module.exports = async (options) => {
  options = config(options)

  const worker = await request(Object.assign({}, config.request, {
    uri: `${options.pubsub.master}/-/worker`,
    json: true,
    retries: 100,
    retryDelay: 5000
  }))

  options.ipfs.s3.path = `${options.ipfs.s3.path}-${worker.index}`
  options.ipfs.port = 10000 + worker.index
  options.external.ipfsPort = await findExternalPort(options)

  const result = await server(options, async (app, ipfs) => {
    app.get('/', root(options, ipfs, app, worker))

    // intercept requests for tarballs and manifests
    app.get('/*.tgz', tarball(options, ipfs, app))
    app.get('/*', manifest(options, ipfs, app))

    // everything else should just proxy for the registry
    const registry = proxy(options.registry, {
      limit: options.registryUploadSizeLimit
    })
    app.put('/*', registry)
    app.post('/*', registry)
    app.patch('/*', registry)
    app.delete('/*', registry)
    app.get('/-/whoami', registry)

    await replicationWorker(options, ipfs, app)
  })

  // finished initialisation
  await request(Object.assign({}, config.request, {
    method: 'post',
    uri: `${options.pubsub.master}/-/worker`,
    json: true,
    retries: 100,
    retryDelay: 5000
  }))

  let url = getExternalUrl(options)

  console.info(`🔧 Please either update your npm config with 'npm config set registry ${url}'`) // eslint-disable-line no-console
  console.info(`🔧 or use the '--registry' flag, eg: 'npm install --registry=${url}'`) // eslint-disable-line no-console

  return result
}
