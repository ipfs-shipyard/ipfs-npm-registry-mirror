'use strict'

const {
  online
} = require('./workers')

module.exports = () => {
  return async (request, response, next) => {
    online()

    response.statusCode = 204
    response.setHeader('Content-type', 'application/json; charset=utf-8')
    response.end()
  }
}
