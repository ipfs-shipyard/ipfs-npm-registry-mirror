'use strict'

const AbortController = require('abort-controller')

module.exports = function (request, response, next) {
  const controller = new AbortController()
  response.locals.signal = controller.signal

  request.on('aborted', () => {
    controller.abort()
  })

  next()
}
