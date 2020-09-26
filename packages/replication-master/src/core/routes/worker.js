'use strict'

const {
  connect
} = require('./workers')

module.exports = () => {
  return (request, response) => {
    const worker = request.query.worker

    if (!worker) {
      return response.status(400).send('Bad Request')
    }

    const info = {
      index: connect(worker)
    }

    response.statusCode = 200
    response.setHeader('Content-type', 'application/json; charset=utf-8')
    response.send(JSON.stringify(info, null, 2))
  }
}
