'use strict'

const pkg = require('../../../package.json')
const findBaseDir = require('ipfs-registry-mirror-common/utils/find-base-dir')

let info
let lastUpdate

const findInfo = async (config, ipfs, root, topic, seq) => {
  if (!lastUpdate || lastUpdate < (Date.now() - 30000)) {
    const [
      id,
      peers,
      topicPeers
    ] = await Promise.all([
      ipfs.id(),
      ipfs.swarm.addrs(),
      ipfs.pubsub.peers(topic)
    ])

    id.addresses = [
      `/ip4/${config.external.ip}/tcp/${config.ipfs.port}/ipfs/${id.id}`,
      `/dns4/${config.external.host}/tcp/${config.ipfs.port}/ipfs/${id.id}`
    ]

    info = {
      name: pkg.name,
      version: pkg.version,
      seq,
      ipfs: id,
      peers: peers.map(peer => peer.id.toString()),
      topicPeers,
      topic,
      // until js can resolve IPNS names remotely, just use the raw hash
      root: `/ipfs/${await findBaseDir(ipfs, config)}`
    }

    lastUpdate = Date.now()
  }

  return info
}

module.exports = (config, ipfs, app, root, topic) => {
  let seq

  app.on('seq', (s) => {
    seq = s
  })

  return async (request, response, next) => {
    try {
      const info = await findInfo(config, ipfs, root, topic, seq)

      response.statusCode = 200
      response.setHeader('Content-type', 'application/json; charset=utf-8')
      response.send(JSON.stringify(info, null, 2))
    } catch (error) {
      response.statusCode = 500
      response.setHeader('Content-type', 'application/text; charset=utf-8')
      response.send(error)
    }
  }
}
