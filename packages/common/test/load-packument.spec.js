/* eslint-env mocha */
'use strict'

const mock = require('mock-require')
const sinon = require('sinon')
const expect = require('chai')
  .use(require('dirty-chai'))
  .expect
const hat = require('hat')

const pkg = (name) => {
  return {
    name: name,
    versions: {
      '0.0.1': {
        name: name,
        dist: {
          tarball: `https://foo.registry.com/${name}.tgz`
        }
      }
    }
  }
}

describe('load-packument', () => {
  let loadPackument
  let savePackument
  let request
  let ipfs
  let config

  const existentPackage = pkg(`i-exist-${hat()}`)
  const nonExistentPackage = pkg(`i-do-not-exist-${hat()}`)
  const newPackage = pkg(`i-am-new-${hat()}`)
  const updatedPackage = pkg(`i-have-new-${hat()}`)
  const newVersionOfUpdatedPackage = pkg(updatedPackage.name)

  beforeEach(() => {
    config = {
      registryUpdateInterval: 0,
      registryReadTimeout: 10000,
      registries: [
        'http://foo'
      ],
      ipfs: {
        prefix: `/registry-prefix-${hat()}`
      },
      request: {},
      http: {
        host: 'localhost',
        port: 8080,
        protocol: 'http'
      }
    }

    request = sinon.stub()
    savePackument = sinon.stub()

    mock('../utils/retry-request', request)
    mock('../utils/save-packument', savePackument)

    loadPackument = mock.reRequire('../utils/load-packument')

    ipfs = {
      files: {
        read: sinon.stub(),
        write: sinon.stub()
      }
    }
  })

  afterEach(() => {
    mock.stopAll()
  })

  it('should load a packument from ipfs', async () => {
    ipfs.files.read.withArgs(`${config.ipfs.prefix}/${existentPackage.name}`)
      .returns([
        Buffer.from(JSON.stringify(existentPackage))
      ])

    request
      .withArgs({
        uri: `${config.registry}/${existentPackage.name}`,
        json: true
      })
      .resolves(existentPackage)

    const result = await loadPackument(existentPackage.name, ipfs, config)

    expect(result).to.deep.equal(existentPackage)
    expect(savePackument.called).to.be.false()
    expect(request.called).to.be.true()
  })

  it('should load a packument from npm when not found in mfs', async () => {
    ipfs.files.read.withArgs(`${config.ipfs.prefix}/${newPackage.name}`)
      .returns(async function * () { // eslint-disable-line require-yield,require-await
        throw new Error('file does not exist')
      }())

    request
      .withArgs({
        uri: `${config.registries[0]}/${newPackage.name}`,
        json: true
      })
      .resolves(newPackage)

    const result = await loadPackument(newPackage.name, ipfs, config)

    expect(result).to.deep.equal(newPackage)
    expect(savePackument.called).to.be.true()
    expect(request.called).to.be.true()
  })

  it('should favour an updated packument from npm', async () => {
    updatedPackage.versions = {
      '0.0.1': {
        dist: {
          cid: 'a-cid',
          tarball: 'a-tarball',
          source: 'original-tarball'
        }
      }
    }

    newVersionOfUpdatedPackage.versions = {
      '0.0.1': {
        dist: {
          tarball: 'original-tarball'
        }
      },
      '0.0.2': {
        dist: {
          tarball: 'new-tarball'
        }
      }
    }

    ipfs.files.read.withArgs(`${config.ipfs.prefix}/${updatedPackage.name}`)
      .returns(async function * () { // eslint-disable-line require-await
        yield Buffer.from(JSON.stringify(updatedPackage))
      }())

    request
      .withArgs({
        uri: `${config.registries[0]}/${updatedPackage.name}`,
        json: true
      })
      .resolves(JSON.parse(JSON.stringify(newVersionOfUpdatedPackage)))

    const result = await loadPackument(updatedPackage.name, ipfs, config)

    expect(result.versions['0.0.1'].dist.cid).to.equal(updatedPackage.versions['0.0.1'].dist.cid)
    expect(result.versions['0.0.2'].dist.tarball).to.equal(newVersionOfUpdatedPackage.versions['0.0.2'].dist.tarball)

    expect(savePackument.called).to.be.true()
    expect(request.called).to.be.true()
  })

  it('should explode when a module does not exist', async () => {
    ipfs.files.read.withArgs(`${config.ipfs.prefix}/${nonExistentPackage.name}`)
      .returns(async function * () { // eslint-disable-line require-yield,require-await
        throw new Error('file does not exist')
      }())

    request
      .withArgs({
        uri: `${config.registries[0]}/${nonExistentPackage.name}`,
        json: true
      })
      .rejects(new Error('404'))

    try {
      await loadPackument(nonExistentPackage.name, ipfs, config)
      throw new Error('Expected loadPackument to throw')
    } catch (error) {
      expect(error.message).to.include('not found')
    }
  })

  it('should download from a backup registry', async () => {
    const options = {
      ...config,
      registries: [
        ...config.registries,
        'https://regregreg.npm.com'
      ]
    }

    ipfs.files.read.withArgs(`${options.ipfs.prefix}/${existentPackage.name}`)
      .returns(async function * () { // eslint-disable-line require-yield,require-await
        throw new Error('file does not exist')
      }())

    request
      .withArgs({
        uri: `${options.registries[0]}/${existentPackage.name}`,
        json: true
      })
      .rejects(new Error('404'))

    request
      .withArgs({
        uri: `${options.registries[1]}/${existentPackage.name}`,
        json: true
      })
      .resolves(existentPackage)

    const result = await loadPackument(existentPackage.name, ipfs, options)

    expect(result).to.deep.equal(existentPackage)
    expect(savePackument.called).to.be.true()
    expect(request.called).to.be.true()
  })
})
