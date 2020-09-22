'use strict'

const getAnIPFS = require('ipfs-registry-mirror-common/utils/get-an-ipfs')
const ingestModule = require('./ingest-module')

process.on('message', async ({ packument, seq, options }) => {
  const ipfs = await getAnIPFS(options)

  try {
    process.send(await ingestModule({ packument, seq, ipfs, options }))
  } catch (error) {
    process.send({
      seq,
      name: packument.name,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      }
    })
  }
})
