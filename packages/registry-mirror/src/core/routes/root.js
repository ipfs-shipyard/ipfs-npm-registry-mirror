'use strict'

const pkg = require('../../../package.json')
const findBaseDir = require('ipfs-registry-mirror-common/utils/find-base-dir')

let info
let lastUpdate

const findInfo = async (config, ipfs, worker) => {
  if (!lastUpdate || lastUpdate < (Date.now() - 30000)) {
    const [
      id,
      peers,
      topicPeers,
      baseDir
    ] = await Promise.all([
      ipfs.id(),
      ipfs.swarm.addrs(),
      config.pubsub.topic ? ipfs.pubsub.peers(config.pubsub.topic) : [],
      findBaseDir(ipfs, config)
    ])

    id.addresses = [
      `/ip4/${config.external.ip}/tcp/${config.external.ipfsPort}/ipfs/${id.id}`,
      `/dns4/${config.external.host}/tcp/${config.external.ipfsPort}/ipfs/${id.id}`
    ]

    info = {
      name: pkg.name,
      index: worker.index,
      version: pkg.version,
      ipfs: id,
      peers: peers.map(peer => peer.id.toString()),
      topicPeers,
      // until js can resolve IPNS names remotely, just use the raw hash
      root: `/ipfs/${baseDir}`
    }

    lastUpdate = Date.now()
  }

  return info
}

module.exports = (config, ipfs, app, worker) => {
  return async (request, response, next) => {
    response.statusCode = 200
    response.setHeader('Content-type', 'application/json; charset=utf-8')
    response.send(JSON.stringify(await findInfo(config, request.app.locals.ipfs, worker), null, 2))
  }
}
