'use strict'

const IPFS = require('ipfs')
const s3Repo = require('./s3-repo')
const fsRepo = require('./fs-repo')
const clusterRepo = require('./cluster-repo')
const log = require('./log')
const cluster = require('cluster')

const randomPort = () => {
  return Math.floor(Math.random() * 64535) + 1000
}

const getAnIPFS = async (config) => {
  if (config.ipfs.port && config.ipfs.host) {
    config.store.port = config.ipfs.port
    config.store.host = config.ipfs.host
    log(`👺 Connecting to remote IPFS daemon at ${config.ipfs.port}:${config.ipfs.host}`)
  } else {
    log('😈 Using in-process IPFS daemon')
  }

  let repo

  if (config.ipfs.store === 's3') {
    repo = s3Repo(config.ipfs.s3)
  }

  if (config.ipfs.store === 'fs') {
    if (config.clone.concurrency) {
      repo = clusterRepo(config.ipfs.fs)
    } else {
      repo = fsRepo(config.ipfs.fs)
    }
  }

  log('🏁 Starting an IPFS instance')

  const ipfs = await IPFS.create({
    pass: config.ipfs.pass,
    init: {
      emptyRepo: true
    },
    repo,
    EXPERIMENTAL: {
      sharding: true
    },
    pubsub: {
      enabled: true
    },
    preload: {
      enabled: false
    },
    config: {
      Addresses: {
        Swarm: cluster.isMaster ? [
          `/ip4/0.0.0.0/tcp/${config.ipfs.port || randomPort()}`,
          `/ip4/127.0.0.1/tcp/${config.ipfs.wsPort || randomPort()}/ws`
        ] : [],
        API: `/ip4/127.0.0.1/tcp/${config.ipfs.apiPort || randomPort()}`,
        Gateway: `/ip4/127.0.0.1/tcp/${config.ipfs.gatewayPort || randomPort()}`
      }
    }
  })

  process.on('exit', () => {
    ipfs.stop()
  })

  return ipfs
}

module.exports = getAnIPFS
