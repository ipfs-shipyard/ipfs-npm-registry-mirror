/* eslint-env mocha */
'use strict'

const sinon = require('sinon')
const expect = require('chai')
  .use(require('dirty-chai'))
  .expect
const hat = require('hat')
const findBaseDir = require('../utils/find-base-dir')

describe('find-base-dir', () => {
  let containingDirectory
  let dirName
  let prefix
  let config
  let ipfs

  beforeEach(() => {
    containingDirectory = `/${hat()}/${hat()}`
    dirName = hat()
    prefix = `${containingDirectory}/${dirName}`
    config = {
      ipfs: {
        prefix
      }
    }
    ipfs = {
      files: {
        ls: sinon.stub(),
        mkdir: sinon.stub()
      }
    }
  })

  it('should find an existing base dir', async () => {
    const dirHash = 'QmSomethingSomething'
    ipfs.files.stat = sinon.stub().withArgs(config.ipfs.prefix)
      .resolves({
        name: dirName,
        cid: dirHash
      })

    const result = await findBaseDir(ipfs, config)

    expect(result).to.equal(dirHash)
    expect(ipfs.files.mkdir.called).to.be.false()
  })

  it('should create the base dir if it does not exist', async () => {
    const dirHash = 'QmSomethingSomething'
    ipfs.files.stat = sinon.stub()
      .onFirstCall().throws(new Error('basedir does not exist'))
      .onSecondCall().returns({
        name: dirName,
        cid: dirHash
      })

    const result = await findBaseDir(ipfs, config)

    expect(result).to.equal(dirHash)
    expect(ipfs.files.mkdir.called).to.be.true()
    expect(ipfs.files.mkdir.getCall(0).args[0]).to.equal(prefix)
  })
})
