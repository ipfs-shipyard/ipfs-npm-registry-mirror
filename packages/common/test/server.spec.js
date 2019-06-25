/* eslint-env mocha */
'use strict'

const mock = require('mock-require')
const expect = require('chai')
  .use(require('dirty-chai'))
  .expect
const EventEmitter = require('events').EventEmitter
const request = require('../utils/retry-request')

class IPFS extends EventEmitter {
  constructor () {
    super()

    setTimeout(() => {
      this.emit('ready')
    }, 100)
  }

  stop () {

  }
}

describe('server', function () {
  this.timeout(10000)
  let server

  beforeEach(() => {
    mock('ipfs', IPFS)

    server = mock.reRequire('../server')
  })

  afterEach(() => {
    mock.stopAll()
  })

  it('should create a server', async () => {
    const config = {
      http: {

      },
      ipfs: {
        store: 'fs',
        fs: {

        }
      }
    }
    const s = await server(config)

    const result = await request({
      uri: `http://localhost:${config.http.port}/favicon.ico`
    })

    expect(result).to.be.ok()

    await s.stop()
  })
})
