'use strict'

const log = require('../utils/log')

module.exports = function (error, request, response, next) {
  log(`💀 ${request.method} ${request.url} ${response.statusCode}`, error)

  next()
}
