'use strict'

let workers = 0
let initialised = 0

module.exports = {
  status: () => {
    return {
      workers,
      initialised,
      ready: workers === 0 ? true : initialised === workers
    }
  },

  connect: () => {
    workers++

    return workers - 1
  },

  online: () => {
    initialised++
  }
}
