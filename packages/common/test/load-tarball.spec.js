/* eslint-env mocha */
'use strict'

const mock = require('mock-require')
const sinon = require('sinon')
const expect = require('chai')
  .use(require('dirty-chai'))
  .expect
const hat = require('hat')
const CID = require('cids')
const toBuffer = require('it-to-buffer')

describe('load-tarball', () => {
  let loadTarball
  let loadPackument
  let saveTarball
  let ipfs
  let config

  beforeEach(() => {
    config = {
      registryUpdateInterval: 0,
      registry: 'http://foo',
      ipfs: {
        prefix: `/registry-prefix-${hat()}`
      },
      request: {

      },
      http: {
        host: 'localhost',
        port: 8080,
        protocol: 'http'
      }
    }

    loadPackument = sinon.stub()
    saveTarball = sinon.stub()

    mock('../utils/load-packument', loadPackument)
    mock('../utils/save-tarball', saveTarball)

    loadTarball = mock.reRequire('../utils/load-tarball')

    ipfs = {
      cat: sinon.stub()
    }
  })

  afterEach(() => {
    mock.stopAll()
  })

  it('should load a tarball from ipfs', async () => {
    const packageName = `a-module-${hat()}`
    const packageVersion = '1.0.0'
    const path = `/${packageName}/-/${packageName}-${packageVersion}.tgz`
    const pkg = {
      name: packageName,
      versions: {
        [packageVersion]: {
          dist: {
            cid: 'QmZEYeEin6wEB7WNyiT7stYTmbYFGy7BzM7T3hRDzRxTvY'
          }
        }
      }
    }

    loadPackument.withArgs(packageName, ipfs, config)
      .returns(pkg)

    ipfs.cat
      .withArgs(new CID(pkg.versions[packageVersion].dist.cid))
      .returns(async function * () { // eslint-disable-line require-await
        yield Buffer.from('ok')
      }())

    const result = await toBuffer(loadTarball(path, ipfs, config))

    expect(result.toString()).to.equal('ok')
  })

  it('should download a tarball that has no cid', async () => {
    const packageName = `a-module-${hat()}`
    const packageVersion = '1.0.0'
    const path = `/${packageName}/-/${packageName}-${packageVersion}.tgz`
    const pkg = {
      name: packageName,
      versions: {
        [packageVersion]: {
          dist: {

          }
        }
      }
    }

    loadPackument.withArgs(packageName, ipfs, config)
      .returns(pkg)

    saveTarball.withArgs(pkg.name, packageVersion, ipfs, config)
      .callsFake(() => {
        pkg.versions[packageVersion].dist.cid = 'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'
      })

    ipfs.cat
      .withArgs(new CID('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'))
      .returns(async function * () { // eslint-disable-line require-await
        yield Buffer.from('also ok')
      }())

    const result = await toBuffer(loadTarball(path, ipfs, config))

    expect(result.toString()).to.equal('also ok')
  })
})
