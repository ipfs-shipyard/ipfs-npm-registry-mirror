'use strict'

const log = require('./log')
const IPFSRepo = require('ipfs-repo')
const cluster = require('cluster')
const multileveldown = require('multileveldown')
const LevelDataStore = require('datastore-level')
const FileDataStore = require('datastore-fs')
const level = require('level')
const net = require('net')
const memdown = require('memdown')

let lock = 'fs'
let db

if (cluster.isWorker) {
  lock = 'memory'
}

const createMasterLevel = (path, port) => {
  return new Promise((resolve, reject) => {
    level(path, {
      valueEncoding: 'binary',
      compression: false // same default as go
    }, (err, master) => {
      if (err) {
        return reject(err)
      }

      db = master

      var server = net.createServer((sock) => {
        sock.on('error', () => {
          sock.destroy()
        })

        sock.pipe(multileveldown.server(db)).pipe(sock)
      })

      server.listen(port, (err) => {
        if (err) {
          return reject(err)
        }

        resolve()
      })
    })
  })
}

const fsRepo = ({ repo, port = 9000 }) => {
  if (process.env.NODE_ENV === 'development') {
    repo = `${repo}-test`
  }

  log(`📁 Using fs repo at ${repo}`)

  class MultiLeveLDataStore extends LevelDataStore {
    constructor (path, opts) {
      super(path, {
        ...opts,
        db: () => memdown()
      })

      this.db = multileveldown.client({
        retry: true,
        valueEncoding: 'binary',
        compression: false // same default as go
      })
      this.path = path
      this.open()
    }

    async open () {
      if (cluster.isMaster && !db) {
        await createMasterLevel(repo, port)
      }

      const sock = net.connect(port)
      sock.pipe(this.db.connect()).pipe(sock)
    }
  }

  return new IPFSRepo(repo, {
    lock: lock,
    storageBackends: {
      root: FileDataStore,
      blocks: FileDataStore,
      keys: FileDataStore,
      datastore: MultiLeveLDataStore
    }
  })
}

module.exports = fsRepo
