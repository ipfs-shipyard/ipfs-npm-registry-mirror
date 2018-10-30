'use strict'

const S3 = require('aws-sdk/clients/s3')
const S3Store = require('datastore-s3')
const IPFSRepo = require('ipfs-repo')

const s3Repo = ({ region, bucket, path, accessKeyId, secretAccessKey, createIfMissing }) => {
  if (process.env.NODE_ENV === 'development') {
    path = `${path}-test`
  }

  const storeconfig = {
    s3: new S3({
      params: {
        Bucket: bucket
      },
      region,
      accessKeyId,
      secretAccessKey
    }),
    createIfMissing
  }

  const store = new S3Store(path, storeconfig)

  class Store {
    constructor () {
      return store
    }
  }

  const lock = {
    getLockfilePath: () => {},
    lock: (dir, cb) => {
      cb(null, lock.getCloser())
    },
    getCloser: (path) => {
      return {
        close: (cb) => {
          cb()
        }
      }
    },
    locked: (dir, cb) => {
      cb(null, false)
    }
  }

  return new IPFSRepo(path, {
    storageBackends: {
      root: Store,
      blocks: Store,
      keys: Store,
      datastore: Store
    },
    storageBackendconfig: {
      root: storeconfig,
      blocks: storeconfig,
      keys: storeconfig,
      datastore: storeconfig
    },
    lock: lock
  })
}

module.exports = s3Repo
