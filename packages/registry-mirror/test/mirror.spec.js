/* eslint-env mocha */
'use strict'

const mock = require('mock-require')
const request = require('request-promise')
const expect = require('chai')
  .use(require('dirty-chai'))
  .expect
const { DAGNode } = require('ipld-dag-pb')
const UnixFS = require('ipfs-unixfs')
const {
  createTestServer,
  destroyTestServers
} = require('ipfs-registry-mirror-common/test/fixtures/test-server')
const createReplicationMaster = require('./fixtures/create-replication-master')
const pkg = require('../package.json')
const path = require('path')
const os = require('os')
const hat = require('hat')
const delay = require('delay')
const toBuffer = require('it-to-buffer')

describe('mirror', function () {
  this.timeout(120000)

  let replicationMaster
  let baseDir
  let startMirror
  let mirror
  let mirrorUrl
  const upstreamModules = {}
  let config

  const serverConfig = (registry, replication, config = {}) => {
    return Object.assign({}, {
      httpProtocol: 'http',
      httpHost: '127.0.0.1',
      registries: [
        `http://127.0.0.1:${registry.address().port}`
      ],
      registryReadTimeout: 5000,
      requestRetries: 5,
      requestRetryDelay: 100,
      ipfsMfsPrefix: baseDir,
      requestTimeout: 1000,
      ipfsStoreType: 'fs',
      ipfsRepo: path.join(os.tmpdir(), hat()),
      ipfsFlush: true,
      registryUpdateInterval: 0,
      pubsubMaster: `http://127.0.0.1:${replication.address().port}`
    }, config)
  }

  before(async () => {
    baseDir = `/commons-registry-test-${hat()}`

    startMirror = mock.reRequire('../src/core')

    const registryServer = await createTestServer(upstreamModules)
    replicationMaster = await createReplicationMaster()
    config = serverConfig(registryServer, replicationMaster)

    mirror = await startMirror(config)

    // make sure the mirror is connected to the master
    const master = await replicationMaster.ipfs.id()
    await mirror.app.locals.ipfs.swarm.connect(master.addresses[0])

    config.httpPort = mirror.server.address().port

    mirrorUrl = `${config.httpProtocol}://${config.httpHost}:${config.httpPort}`
  })

  after(async function () {
    mock.stopAll()

    await destroyTestServers()

    if (mirror && mirror.stop) {
      await mirror.stop()
    }
  })

  it('should serve a packument', async function () {
    const moduleName = `module-${hat()}`
    const content = JSON.stringify({
      _rev: '12345',
      name: moduleName,
      versions: {}
    }, null, 2)

    await mirror.app.locals.ipfs.files.write(`${baseDir}/${moduleName}`, Buffer.from(content), {
      parents: true,
      create: true,
      truncate: true
    })

    const result = await request({
      uri: `${mirrorUrl}/${moduleName}`
    })

    expect(result).to.equal(content)
  })

  it('should serve a tarball', async () => {
    const moduleName = `module-${hat()}`
    const tarballContent = 'tarball-content'
    const fsNode = new UnixFS({ type: 'file', data: Buffer.from(tarballContent) })

    const node = new DAGNode(fsNode.marshal())

    const cid = await mirror.app.locals.ipfs.dag.put(node, {
      version: 0,
      format: 'dag-pb',
      hashAlg: 'sha2-256'
    })

    const manifest = JSON.stringify({
      _rev: '12345',
      name: moduleName,
      versions: {
        '1.0.0': {
          dist: {
            cid: cid.toBaseEncodedString()
          }
        }
      }
    })

    await mirror.app.locals.ipfs.files.write(`${baseDir}/${moduleName}`, Buffer.from(manifest), {
      parents: true,
      create: true,
      truncate: true
    })

    const result = await request({
      uri: `${mirrorUrl}/${moduleName}/-/${moduleName}-1.0.0.tgz`
    })

    expect(result).to.equal(tarballContent)
  })

  it('should serve some basic info', async () => {
    const result = JSON.parse(await request({
      uri: `${mirrorUrl}`
    }))

    expect(result.name).to.equal(pkg.name)
    expect(result.version).to.equal(pkg.version)
  })

  it('should download a missing packument', async () => {
    const moduleName = `module-${hat()}`
    const data = {
      name: moduleName,
      versions: {
        '0.0.1': {
          dist: {
            tarball: `https://some.registry.com/${moduleName}-0.0.1.tgz`
          }
        }
      }
    }

    upstreamModules[`/${moduleName}`] = (request, response) => {
      response.statusCode = 200
      response.end(JSON.stringify(data))
    }

    const result = JSON.parse(await request({
      uri: `${mirrorUrl}/${moduleName}`
    }))

    expect(result.name).to.equal(moduleName)
    expect(Object.keys(result.versions).length).to.equal(Object.keys(data.versions).length)
    expect(result.versions['0.0.1'].dist.source).to.equal(data.versions['0.0.1'].dist.tarball)
  })

  it('should download a missing tarball from an existing module', async () => {
    const moduleName = `module-${hat()}`
    const tarballPath = `${moduleName}/-/${moduleName}-1.0.0.tgz`
    const tarballContent = 'tarball content'
    const packument = JSON.stringify({
      _rev: '12345',
      name: moduleName,
      versions: {
        '1.0.0': {
          dist: {
            tarball: `${config.registries[0]}/${tarballPath}`,
            shasum: '15d0e36e27c69bc758231f8e9add837f40a40cd0'
          }
        }
      }
    })

    upstreamModules[`/${moduleName}`] = (request, response) => {
      response.statusCode = 200
      response.end(packument)
    }
    upstreamModules[`/${tarballPath}`] = (request, response) => {
      response.statusCode = 200
      response.end(tarballContent)
    }

    const result = await request({
      uri: `${mirrorUrl}/${tarballPath}`
    })

    expect(result).to.equal(tarballContent)
  })

  it('should download a manifest from a missing scoped module', async () => {
    const moduleName = `@my-scope/module-${hat()}`
    const data = {
      name: moduleName,
      versions: {
        '0.0.1': {
          dist: {
            tarball: `https://some.registry.com/${moduleName}-0.0.1.tgz`
          }
        }
      }
    }

    upstreamModules[`/${moduleName}`] = (request, response) => {
      response.statusCode = 200
      response.end(JSON.stringify(data))
    }

    const result = JSON.parse(await request({
      uri: `${mirrorUrl}/${moduleName.replace('/', '%2f')}`
    }))

    expect(result.name).to.equal(moduleName)
    expect(result.versions.length).to.equal(data.versions.length)
    expect(result.versions['0.0.1'].dist.source).to.equal(data.versions['0.0.1'].dist.tarball)
  })

  it('should check with the upstream registry for updated versions', async () => {
    const moduleName = `module-${hat()}`
    const tarball1Path = `${moduleName}/-/${moduleName}-1.0.0.tgz`
    const tarball2Path = `${moduleName}/-/${moduleName}-2.0.0.tgz`
    const tarball1Content = 'tarball 1 content'
    const tarball2Content = 'tarball 2 content'
    const manifest1 = JSON.stringify({
      _rev: '12345-1',
      name: moduleName,
      versions: {
        '1.0.0': {
          dist: {
            shasum: '669965318736dfe855479a6dd441d81f101ae5ae',
            tarball: `${config.registries[0]}/${tarball1Path}`
          }
        }
      }
    })
    const manifest2 = JSON.stringify({
      _rev: '12345-2',
      name: moduleName,
      versions: {
        '1.0.0': {
          dist: {
            shasum: '669965318736dfe855479a6dd441d81f101ae5ae',
            tarball: `${config.registries[0]}/${tarball1Path}`
          }
        },
        '2.0.0': {
          dist: {
            shasum: '4e9dab818d5f0a45e4ded14021cf0bc28c456f74',
            tarball: `${config.registries[0]}/${tarball2Path}`
          }
        }
      }
    })
    let invocations = 0

    upstreamModules[`/${moduleName}`] = (request, response) => {
      response.statusCode = 200
      invocations++

      if (invocations === 1) {
        response.end(manifest1)
      } else {
        response.end(manifest2)
      }
    }
    upstreamModules[`/${tarball1Path}`] = (request, response) => {
      response.statusCode = 200
      response.end(tarball1Content)
    }
    upstreamModules[`/${tarball2Path}`] = (request, response) => {
      response.statusCode = 200
      response.end(tarball2Content)
    }

    const result1 = await request({
      uri: `${mirrorUrl}/${tarball1Path}`
    })
    const result2 = await request({
      uri: `${mirrorUrl}/${tarball2Path}`
    })

    expect(result1).to.equal(tarball1Content)
    expect(result2).to.equal(tarball2Content)
  })

  it('should proxy all other requests to the registry', async () => {
    const data = 'hello world'

    upstreamModules['/-/user/org.couchdb.user:dave'] = data

    const result = await request({
      uri: `${mirrorUrl}/-/user/org.couchdb.user:dave`,
      method: 'put'
    })

    expect(result.trim()).to.equal(data.trim())
  })

  it('should retry when 404s are encountered', async () => {
    const moduleName = `module-404-${hat()}`
    const data = JSON.stringify({
      name: moduleName,
      _rev: '12345',
      versions: {}
    })
    let invocations = 0

    upstreamModules[`/${moduleName}`] = (request, response) => {
      invocations++

      if (invocations === 1) {
        response.statusCode = 404
        return response.end('404')
      }

      response.statusCode = 200
      return response.end(data)
    }

    await request({
      uri: `${mirrorUrl}/${moduleName}`
    })

    expect(invocations).to.equal(2)
  })

  it('should not save tarball CID when shasums do not match', async () => {
    const moduleName = `module-${hat()}`
    const tarballPath = `${moduleName}/-/${moduleName}-1.0.0.tgz`
    const tarballContent = 'tarball content'
    const manifest = JSON.stringify({
      _rev: '12345',
      name: moduleName,
      versions: {
        '1.0.0': {
          dist: {
            tarball: `${config.registries[0]}/${tarballPath}`,
            shasum: 'nope!'
          }
        }
      }
    })

    upstreamModules[`/${moduleName}`] = (request, response) => {
      response.statusCode = 200
      response.end(manifest)
    }
    upstreamModules[`/${tarballPath}`] = (request, response) => {
      response.statusCode = 200
      response.end(tarballContent)
    }

    await request({
      uri: `${mirrorUrl}/${tarballPath}`,
      simple: false
    })

    // let the download be processed
    await delay(1000)

    const updated = JSON.parse(await toBuffer(mirror.app.locals.ipfs.files.read(`${baseDir}/${moduleName}`)))

    expect(updated.versions['1.0.0'].dist.cid).to.not.be.ok()
  })

  it('should process an update recieved over pubsub', async () => {
    const moduleName = `updated-module-name-${hat()}`
    const manifest = JSON.stringify({
      _rev: '12345',
      name: moduleName,
      versions: {
        '1.0.0': {
          dist: {
            tarball: `${mirrorUrl}/${moduleName}/-/${moduleName}-1.0.0.tgz`,
            shasum: '123',
            cid: '456',
            source: `${config.registries[0]}/${moduleName}/-/${moduleName}-1.0.0.tgz`
          }
        }
      }
    }, null, 2)

    try {
      await request({
        uri: `${mirrorUrl}/${moduleName}`
      })
    } catch (err) {
      expect(err.message).to.include(`${moduleName} not found`)
    }

    const { cid: packumentCid } = await replicationMaster.ipfs.add(manifest)
    await replicationMaster.ipfs.files.cp(`/ipfs/${packumentCid}`, `${replicationMaster.config.ipfs.prefix}/${moduleName}`, {
      parents: true
    })
    const { cid: rootCid } = await replicationMaster.ipfs.files.stat(replicationMaster.config.ipfs.prefix)

    await replicationMaster.ipfs.pubsub.publish(replicationMaster.config.pubsub.topic, Buffer.from(
      JSON.stringify({
        type: 'update',
        module: moduleName,
        cid: rootCid.toV1().toBaseEncodedString('base32')
      })
    ))

    await delay(5000)

    const packument = await request({
      uri: `${mirrorUrl}/${moduleName}`
    })

    expect(packument).to.deep.equal(manifest)
  })
})
