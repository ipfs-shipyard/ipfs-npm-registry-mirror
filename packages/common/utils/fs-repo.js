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
const { Errors } = require('interface-datastore')

let lock = 'fs'

if (cluster.isWorker) {
  lock = 'memory'
}

const fsRepo = ({ repo }) => {
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

      this.opts = opts
    }

    _initDb (database, path) {
      if (cluster.isMaster) {
        return level(path, {
          valueEncoding: 'binary',
          compression: false // same default as go
        })
      }

      return multileveldown.client({
        retry: true,
        valueEncoding: 'binary',
        compression: false // same default as go
      })
    }

    async open () {
      if (cluster.isMaster) {
        try {
          await this.db.open()

          return new Promise((resolve, reject) => {
            this._server = net.createServer((sock) => {
              sock.on('error', () => {
                sock.destroy()
              })

              sock.pipe(multileveldown.server(this.db)).pipe(sock)
            })

            this._server.listen(this.opts.port, (err) => {
              if (err) {
                return reject(err)
              }

              resolve()
            })
          })
        } catch (err) {
          throw Errors.dbOpenFailedError(err)
        }
      }

      this._sock = net.connect(this.opts.port)
      this._sock.pipe(this.db.connect()).pipe(this._sock)
    }

    close () {
      if (cluster.isMaster) {
        this._server.close()
        return this.db.close()
      }

      this._sock.close()
    }
  }

  return new IPFSRepo(repo, {
    lock: lock,
    storageBackends: {
      root: FileDataStore,
      blocks: FileDataStore,
      keys: FileDataStore,
      datastore: MultiLeveLDataStore,
      pins: MultiLeveLDataStore
    },
    storageBackendOptions: {
      datastore: {
        port: 39281
      },
      pins: {
        port: 39282
      }
    }
  })
}

module.exports = fsRepo
