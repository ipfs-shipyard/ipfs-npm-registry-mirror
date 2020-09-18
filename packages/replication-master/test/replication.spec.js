/* eslint-env mocha */
'use strict'

const mock = require('mock-require')
const path = require('path')
const os = require('os')
const {
  createTestServer,
  destroyTestServers
} = require('ipfs-registry-mirror-common/test/fixtures/test-server')
const createSkimDb = require('./fixtures/create-skim-db')
const expect = require('chai')
  .use(require('dirty-chai'))
  .expect
const hat = require('hat')
const savePackument = require('ipfs-registry-mirror-common/utils/save-packument')
const delay = require('delay')
const request = require('ipfs-registry-mirror-common/utils/retry-request')

const baseDir = '/commons-registry-clone-test'

describe('replication', function () {
  this.timeout(120000)

  let replicationMaster
  const upstreamModules = {}
  let replicationMasterUrl
  let skim
  let config

  const serverConfig = (registry, skim, config = {}) => {
    return Object.assign({}, {
      httpProtocol: 'http',
      httpHost: '127.0.0.1',
      registries: [
        `http://127.0.0.1:${registry.address().port}`
      ],
      requestRetries: 5,
      requestRetryDelay: 100,
      requestConcurrency: 5,
      ipfsMfsPrefix: baseDir,
      requestTimeout: 1000,
      ipfsStoreType: 'fs',
      ipfsRepo: path.join(os.tmpdir(), hat()),
      ipfsFlush: true,
      registryUpdateInterval: 0,
      followSkim: `http://127.0.0.1:${skim.address().port}`,
      followRegistry: `http://127.0.0.1:${registry.address().port}`,
      followConcurrency: 1,
      followUserAgent: 'test UA',
      followSeqFile: path.join(os.tmpdir(), hat()),
      externalHost: 'replication.registry.ipfs.io',
      externalPort: 443,
      externalProtocol: 'https',
      externalIp: '35.178.192.119',
      ipfsPass: 'super-secret-super-secret-super-secret',
      cloneConcurrency: 0,
      cloneDelay: 1
    }, config)
  }

  before(async () => {
    const registry = await createTestServer(upstreamModules)
    skim = await createSkimDb(upstreamModules)

    config = serverConfig(registry, skim)

    const startReplication = mock.reRequire('../src/core')

    replicationMaster = await startReplication(config)

    config.httpPort = replicationMaster.server.address().port

    replicationMasterUrl = `${config.httpProtocol}://${config.httpHost}:${config.httpPort}`
  })

  after(async () => {
    mock.stopAll()

    await destroyTestServers()

    if (replicationMaster && replicationMaster.stop) {
      await replicationMaster.stop()
    }
  })

  it('should publish some info about this node', async () => {
    const info = await request({
      uri: replicationMasterUrl,
      json: true
    })

    expect(info.ipfs).to.be.ok()
    expect(info.ipfs.id).to.be.ok()
    expect(info.ipfs.addresses).to.be.ok()
    expect(info.ipfs.addresses.length).to.be.ok()
    expect(info.root).to.be.ok()
    expect(info.topic).to.be.ok()

    info.ipfs.addresses.forEach(address => {
      expect(address).to.not.contain('127.0.0.1')
      expect(address).to.not.contain('localhost')
    })
  })

  it('should download a new module', () => {
    const module = {
      name: `new-module-${hat()}`,
      version: '1.0.0'
    }
    const tarball = {
      path: `/${module.name}/-/${module.name}-${module.version}.tgz`,
      content: 'I am some binary'
    }

    const data = {
      name: module.name,
      json: {
        name: module.name,
        _rev: '12345',
        versions: {
          [module.version]: {
            dist: {
              tarball: `${config.registry}${tarball.path}`,
              shasum: '3f9f726832b39c2cc7ac515c8a6c97b94b608b0e'
            }
          }
        }
      }
    }

    skim.publish(data, tarball)

    return new Promise((resolve, reject) => {
      replicationMaster.app.once('processed', (event) => {
        try {
          expect(event.name).to.equal(module.name)
          expect(Object.keys(event.versions).length).to.equal(1)
          expect(event.versions[module.version].dist.tarball).to.equal(`${config.registry}${tarball.path}`)
        } catch (error) {
          return reject(error)
        }

        resolve()
      })
    })
  })

  it('should download a module even if the previous one fails', () => {
    const module1 = {
      name: `new-module-${hat()}`,
      version: '1.0.0'
    }
    const module2 = {
      name: `new-module-${hat()}`,
      version: '1.0.0'
    }
    const tarball1 = {
      path: `/${module1.name}/-/${module1.name}-${module1.version}.tgz`,
      content: 'I am some binary'
    }
    const tarball2 = {
      path: `/${module2.name}/-/${module2.name}-${module2.version}.tgz`,
      content: 'I am some binary'
    }

    const data1 = {
      name: module1.name,
      json: {
        name: module1.name,
        _rev: '12345',
        versions: {
          [module1.version]: {
            dist: {
              tarball: `${config.registry}${tarball1.path}`,
              shasum: '3f9f726832b39c2cc7ac515c8a6c97b94b608b0e'
            }
          }
        }
      }
    }
    const data2 = {
      name: module2.name,
      json: {
        name: module2.name,
        _rev: '12345',
        versions: {
          [module2.version]: {
            dist: {
              tarball: `${config.registry}${tarball2.path}`,
              shasum: '3f9f726832b39c2cc7ac515c8a6c97b94b608b0e'
            }
          }
        }
      }
    }

    skim.publish(data1)
    skim.publish(data2, tarball2)

    let sawModule1Update = false

    return new Promise((resolve, reject) => {
      replicationMaster.app.on('processed', (event) => {
        if (event.name === module1.name) {
          sawModule1Update = true
          return
        }

        try {
          expect(sawModule1Update).to.be.true()
          expect(event.name).to.equal(module2.name)
          expect(Object.keys(event.versions).length).to.equal(1)
          expect(event.versions[module2.version].dist.tarball).to.equal(`${config.registry}${tarball2.path}`)
        } catch (error) {
          return reject(error)
        }

        resolve()
      })
    })
  })

  it('should survive an invalid update', async () => {
    const module = {
      name: `new-module-${hat()}`,
      version: '1.0.0'
    }
    const tarball = {
      path: `/${module.name}/-/${module.name}-${module.version}.tgz`,
      content: 'I am some binary'
    }

    const data = {
      name: module.name,
      json: {
        name: module.name,
        _rev: '12345',
        versions: []
      }
    }

    skim.publish(data, tarball)

    await delay(1000)

    // no-one died
  })

  it('should survive npm 503ing', async () => {
    const module = {
      name: `new-module-${hat()}`,
      version: '1.0.0'
    }
    const tarball = {
      path: `/${module.name}/-/${module.name}-${module.version}.tgz`,
      content: 'I am some binary'
    }

    const data = {
      name: module.name,
      json: '<html><body><h1>503 Service Unavailable</h1>\nNo server is available to handle this request.\n</body></html>\n\n'
    }

    skim.publish(data, tarball)

    await delay(1000)

    // no-one died
  })

  it('should survive npm 504ing', async () => {
    const module = {
      name: `new-module-${hat()}`,
      version: '1.0.0'
    }
    const tarball = {
      path: `/${module.name}/-/${module.name}-${module.version}.tgz`,
      content: 'I am some binary'
    }

    const data = {
      name: module.name,
      json: '<html><body><h1>504 Gateway Time-out</h1>\nThe server didn\'t respond in time.\n</body></html>\n\n'
    }

    skim.publish(data, tarball)

    await delay(1000)

    // no-one died
  })

  it('should survive npm 404ing', async () => {
    const module = {
      name: `new-module-${hat()}`,
      version: '1.0.0'
    }
    const tarball = {
      path: `/${module.name}/-/${module.name}-${module.version}.tgz`,
      content: 'I am some binary'
    }

    const data = {
      name: module.name,
      json: {
        error: 'not_found',
        reason: 'missing'
      }
    }

    skim.publish(data, tarball)

    await delay(1000)

    // no-one died
  })

  it('should not download a tarball that already exists', async () => {
    const module = {
      name: `new-module-${hat()}`,
      version: '1.0.0'
    }
    const tarball = {
      path: `/${module.name}/-/${module.name}-${module.version}.tgz`,
      content: 'I am some binary'
    }

    const data = {
      name: module.name,
      json: {
        name: module.name,
        _rev: '12345',
        versions: {
          [module.version]: {
            dist: {
              tarball: `${config.registry}${tarball.path}`,
              shasum: '3f9f726832b39c2cc7ac515c8a6c97b94b608b0e'
            }
          }
        }
      }
    }

    const manifest = {
      name: module.name,
      _rev: '12345',
      versions: {
        '1.0.0': {
          dist: {
            tarball: `${config.externalProtocol}://${config.externalHost}:${config.externalPort}${tarball.path}`,
            source: `${config.registry}${tarball.path}`,
            cid: 'QmZVQm5euZa69LtUFt8HuuBPSpLYMxcxACh6F5M8ZqpbR9',
            shasum: '123'
          }
        }
      }
    }

    await savePackument(manifest, replicationMaster.app.locals.ipfs, {
      ipfs: {
        prefix: baseDir,
        flush: true
      }
    })

    skim.publish(data)

    return new Promise((resolve, reject) => {
      replicationMaster.app.once('processed', (event) => {
        try {
          expect(event.name).to.equal(module.name)
          expect(Object.keys(event.versions).length).to.equal(1)
          expect(event.versions[module.version].dist.tarball).to.equal(`${config.registry}${tarball.path}`)
        } catch (error) {
          return reject(error)
        }

        resolve()
      })
    })
  })

  it('should increment worker ids', async () => {
    const worker1 = await request({
      uri: `${replicationMasterUrl}/-/worker`,
      qs: {
        worker: 'host1'
      },
      json: true
    })

    const worker2 = await request({
      uri: `${replicationMasterUrl}/-/worker`,
      qs: {
        worker: 'host2'
      },
      json: true
    })

    expect(worker1.index).to.equal(0)
    expect(worker2.index).to.equal(1)
  })

  it('should return the same worker id to the same worker', async () => {
    const worker1 = await request({
      uri: `${replicationMasterUrl}/-/worker`,
      qs: {
        worker: 'host1'
      },
      json: true
    })

    const worker2 = await request({
      uri: `${replicationMasterUrl}/-/worker`,
      qs: {
        worker: 'host1'
      },
      json: true
    })

    expect(worker1.index).to.equal(worker2.index)
  })
})
