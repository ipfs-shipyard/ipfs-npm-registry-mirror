'use strict'

const http = require('http')
const IPFSFactory = require('ipfsd-ctl').createFactory({
  type: 'proc',
  ipfsHttpModule: require('ipfs-http-client'),
  ipfsModule: require('ipfs'),
  test: true,
  disposable: true
})

let testServers = []

module.exports = {
  createTestServer: async (resources) => {
    const server = http.createServer((request, response) => {
      let url = request.url

      if (url.includes('?')) {
        url = url.split('?')[0]
      }

      if (resources[url]) {
        if (typeof resources[url] === 'function') {
          return resources[url](request, response)
        }

        response.statusCode = 200
        return response.end(resources[url])
      }

      response.statusCode = 404
      response.end('404')
    })

    await new Promise((resolve, reject) => {
      server.listen((error) => {
        if (error) {
          return reject(error)
        }

        resolve()
      })
    })

    testServers.push(server)

    const node = await IPFSFactory.spawn()

    server.ipfs = node.api

    if (typeof resources === 'function') {
      resources = await resources(server)
    }

    return server
  },

  destroyTestServers: () => {
    const servers = testServers
    testServers = []

    return Promise.all(
      servers.map((server) => {
        return new Promise((resolve) => {
          server.ipfs.stop()
          server.close(resolve)
        })
      })
    )
  }
}
