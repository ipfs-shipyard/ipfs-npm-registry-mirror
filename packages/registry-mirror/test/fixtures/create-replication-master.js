'use strict'

const hat = require('hat')
const {
  createTestServer
} = require('ipfs-registry-mirror-common/test/fixtures/test-server')

const createReplicationMaster = async () => {
  const topic = `topic-${hat()}`

  const replicationMaster = await createTestServer(async server => {
    return {
      '/': JSON.stringify({
        ipfs: await server.ipfs.id(),
        // empty directory
        root: '/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn',
        topic
      }),
      '/-/worker': JSON.stringify({
        index: 0
      })
    }
  })

  replicationMaster.config = {
    pubsub: {
      topic
    },
    ipfs: {
      prefix: '/reg-mas-root'
    }
  }

  return replicationMaster
}

module.exports = createReplicationMaster
