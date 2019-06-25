'use strict'

const {
  online
} = require('./workers')

module.exports = () => {
  return (request, response) => {
    online()

    response.statusCode = 204
    response.setHeader('Content-type', 'application/json; charset=utf-8')
    response.end()
  }
}
