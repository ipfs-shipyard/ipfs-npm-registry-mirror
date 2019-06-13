'use strict'

const IpfsApi = require('ipfs-http-client')
const ipfsdCtrl = require('ipfsd-ctl')
const which = require('which-promise')
const promisify = require('util').promisify
const s3Repo = require('./s3-repo')
const fsRepo = require('./fs-repo')
const IPFS = require('ipfs')

const cleanUpOps = []

const cleanUp = () => {
  Promise.all(
    cleanUpOps.map(op => op())
  )
    .then(() => {
      process.exit(0)
    })
}

process.on('SIGTERM', cleanUp)
process.on('SIGINT', cleanUp)

const spawn = (createArgs, spawnArgs = { init: true }) => {
  return new Promise((resolve, reject) => {
    ipfsdCtrl
      .create(createArgs)
      .spawn(spawnArgs, (error, node) => {
        if (error) {
          return reject(error)
        }

        resolve(node)
      })
  })
}

const startIpfs = async (config) => {
  if (config.ipfs.node === 'proc') {
    console.info('😈 Spawning an in-process IPFS node') // eslint-disable-line no-console

    if (config.ipfs.store === 's3') {
      config.ipfs.repo = s3Repo(config.ipfs.s3)
    }

    if (config.ipfs.store === 'fs') {
      config.ipfs.repo = fsRepo(config.ipfs.fs)
    }

    const node = new IPFS({
      repo: config.ipfs.repo,
      EXPERIMENTAL: {
        pubsub: true,
        sharding: true
      },
      preload: {
        enabled: false
      },
      config: {
        Addresses: {
          Swarm: [
            `/ip4/0.0.0.0/tcp/${config.ipfs.port || randomPort()}`,
            `/ip4/127.0.0.1/tcp/${config.ipfs.wsPort || randomPort()}/ws`
          ],
          API: `/ip4/127.0.0.1/tcp/${config.ipfs.apiPort || randomPort()}`,
          Gateway: `/ip4/127.0.0.1/tcp/${config.ipfs.gatewayPort || randomPort()}`
        }
      }
    })
    node.once('ready', () => callback(null, ipfs))
    node.once('error', (error) => callback(error))

    process.on('exit', () => {
      ipfs.stop()
    })

    return node
  } else if (config.ipfs.node === 'disposable') {
    console.info('😈 Spawning an in-process disposable IPFS node') // eslint-disable-line no-console

    return spawn({
      type: 'proc',
      exec: IPFS
    })
  } else if (config.ipfs.node === 'js') {
    console.info('😈 Spawning a js-IPFS node') // eslint-disable-line no-console

    return spawn({
      type: 'js',
      exec: await which('jsipfs')
    })
  } else if (config.ipfs.node === 'go') {
    console.info('😈 Spawning a go-IPFS node') // eslint-disable-line no-console

    return spawn({
      type: 'go',
      exec: await which('ipfs')
    })
  }

  console.info(`😈 Connecting to a remote IPFS node at ${config.ipfs.node}`) // eslint-disable-line no-console

  return {
    api: new IpfsApi(config.ipfs.node),
    stop: (cb) => cb()
  }
}

const createIpfs = options => {
  return async () => {
    const ipfs = await startIpfs(options)

    cleanUpOps.push(() => {
      return new Promise((resolve) => {
        if (options.ipfs.node !== 'proc') {
          return resolve()
        }

        ipfs.stop(() => {
          console.info('😈 IPFS node stopped') // eslint-disable-line no-console

          resolve()
        })
      })
    })

    return ipfs
  }
}

module.exports = createIpfs
