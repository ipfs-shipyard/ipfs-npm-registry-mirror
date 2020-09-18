'use strict'

const delay = require('delay')

const timeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((resolve, reject) => {
      delay(ms)
        .then(() => {
          const error = new Error('Timed out')
          error.code = 'ETIMEOUT'

          reject(error)
        }, reject)
    })
  ])
}

module.exports = timeout
