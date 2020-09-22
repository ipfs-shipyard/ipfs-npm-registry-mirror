/* eslint-env mocha */
'use strict'

const sinon = require('sinon')
const expect = require('chai')
  .use(require('dirty-chai'))
  .expect
const hat = require('hat')
const savePackument = require('../utils/save-packument')

describe('save-packument', () => {
  let ipfs
  let config

  beforeEach(() => {
    config = {
      ipfs: {
        prefix: `/registry-prefix-${hat()}`,
        flush: true
      }
    }

    ipfs = {
      files: {
        write: sinon.stub()
      }
    }
  })

  it('should save a packument to ipfs', async () => {
    const pkg = {
      name: `module-${hat()}`
    }

    ipfs.files.write.withArgs(`${config.ipfs.prefix}/${pkg.name}`)
      .resolves()

    await savePackument(pkg, ipfs, config)

    expect(ipfs.files.write.called).to.be.true()
  })

  it('should require a package name', async () => {
    const pkg = {

    }

    try {
      await savePackument(pkg, ipfs, config)
      throw new Error('Expected savePackument to throw')
    } catch (error) {
      expect(error.message).to.contain('No name found')
      expect(ipfs.files.write.called).to.be.false()
    }
  })
})
