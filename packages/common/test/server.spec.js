/* eslint-env mocha */
'use strict'

const mock = require('mock-require')
const expect = require('chai')
  .use(require('dirty-chai'))
  .expect
const sinon = require('sinon')
const request = require('../utils/retry-request')

describe('server', function () {
  this.timeout(10000)
  let server
  let getAnIpfs
  let ipfs

  beforeEach(() => {
    ipfs = {
      stop: sinon.stub()
    }
    getAnIpfs = sinon.stub().returns(ipfs)

    mock('../utils/get-an-ipfs', getAnIpfs)

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

    expect(ipfs.stop.called).to.be.true()
  })
})
