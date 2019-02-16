'use strict'

const log = require('../utils/log')

module.exports = function (request, response, next) {
  response.locals.start = Date.now()

  response.on('finish', () => {
    const disposition = response.getHeader('Content-Disposition')
    let prefix = '📄'

    if (disposition && disposition.endsWith('tgz')) {
      prefix = '🎁'
    }

    log(`${prefix} ${request.method} ${request.url} ${response.statusCode} ${Date.now() - response.locals.start}ms`)
  })

  next()
}
