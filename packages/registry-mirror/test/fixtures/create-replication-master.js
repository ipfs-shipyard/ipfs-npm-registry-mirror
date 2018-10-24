'use strict'

const hat = require('hat')
const {
  createTestServer
} = require('ipfs-registry-mirror-common/test/fixtures/test-server')

const createReplicationMaster = async () => {
  const id = hat()
  const topic = `topic-${hat()}`

  let replicationMaster = await createTestServer({
    '/': JSON.stringify({
      ipfs: {
        id
      },
      // empty directory
      root: '/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn',
      topic
    }),
    '/-/worker': JSON.stringify({
      index: 0
    })
  })

  return replicationMaster
}

module.exports = createReplicationMaster
