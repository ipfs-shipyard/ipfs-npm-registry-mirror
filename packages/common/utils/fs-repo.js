'use strict'

const log = require('./log')

const fsRepo = ({ repo }) => {
  if (process.env.NODE_ENV === 'development') {
    repo = `${repo}-test`
  }

  log(`📁 Using fs repo at ${repo}`)

  return repo
}

module.exports = fsRepo
