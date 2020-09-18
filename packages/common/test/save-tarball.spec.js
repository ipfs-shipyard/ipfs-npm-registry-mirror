/* eslint-env mocha */
'use strict'

const mock = require('mock-require')
const sinon = require('sinon')
const expect = require('chai')
  .use(require('dirty-chai'))
  .expect
const hat = require('hat')
const {
  PassThrough
} = require('stream')
const CID = require('cids')

describe('save-tarball', () => {
  let saveTarball
  let loadPackument
  let savePackument
  let request
  let ipfs
  let config

  beforeEach(() => {
    config = {
      request: {

      },
      clone: {

      }
    }

    request = sinon.stub()
    loadPackument = sinon.stub()
    savePackument = sinon.stub()

    mock('../utils/retry-request', request)
    mock('../utils/save-packument', savePackument)
    mock('../utils/load-packument', loadPackument)

    saveTarball = mock.reRequire('../utils/save-tarball')

    ipfs = {
      add: sinon.stub()
    }
  })

  afterEach(() => {
    mock.stopAll()
  })

  it('should not save a tarball we have already downloaded', async () => {
    const versionNumber = '1.0.0'
    const pkg = {
      name: `module-${hat()}`,
      versions: {
        [versionNumber]: {
          dist: {
            cid: 'a-cid',
            source: 'tarball-url',
            shasum: 'tarball-shasum'
          }
        }
      }
    }

    loadPackument.withArgs(pkg.name, ipfs, config)
      .resolves(pkg)

    await saveTarball(pkg.name, versionNumber, ipfs, config)

    expect(request.called).to.be.false()
  })

  it('should download a missing tarball', async () => {
    const versionNumber = '1.0.0'
    const pkg = {
      name: `module-${hat()}`,
      versions: {
        [versionNumber]: {
          dist: {
            tarball: 'tarball-url',
            shasum: '3c4fb10163dc33fd83b588fe36af9aa5efba2985'
          }
        }
      }
    }

    loadPackument.withArgs(pkg.name, ipfs, config)
      .resolves(pkg)

    ipfs.add.callsFake(stream => {
      return new Promise((resolve) => {
        stream.on('end', () => {
          resolve({
            cid: new CID('QmZEYeEin6wEB7WNyiT7stYTmbYFGy7BzM7T3hRDzRxTvY').toV1()
          })
        })
      })
    })

    request.withArgs({
      uri: 'tarball-url'
    })
      .callsFake(() => {
        const stream = new PassThrough()

        setTimeout(() => {
          stream.write('tarball-content')
          stream.end()
        }, 100)

        return Promise.resolve(stream)
      })

    await saveTarball(pkg.name, versionNumber, ipfs, config)

    expect(request.called).to.be.true()
  })
})
