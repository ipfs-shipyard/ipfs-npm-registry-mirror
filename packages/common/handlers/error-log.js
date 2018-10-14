'use strict'

module.exports = function (error, request, response, next) {
  console.error(`💀 ${request.method} ${request.url} ${response.statusCode} - ${error.stack}`)

  next()
}
