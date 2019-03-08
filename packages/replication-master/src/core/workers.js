'use strict'

const log = require('ipfs-registry-mirror-common/utils/log')

let workers = []
let initialised = 0

module.exports = {
  status: () => {
    return {
      workers,
      initialised,
      ready: workers.length === 0 ? true : initialised === workers.length
    }
  },

  connect: (worker) => {
    let index = workers.indexOf(worker)

    if (index === -1) {
      index = workers.push(worker) - 1
    }

    log(`👷‍♀️ Worker ${worker} assigned index ${index}`)

    return index
  },

  online: () => {
    initialised++
  }
}
