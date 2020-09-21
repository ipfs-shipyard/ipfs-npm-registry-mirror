'use strict'

const log = require('./log')
const IPFSRepo = require('ipfs-repo')

const fsRepo = ({ repo }) => {
  if (process.env.NODE_ENV === 'development') {
    repo = `${repo}-test`
  }

  log(`📁 Using fs repo at ${repo}`)

  return new IPFSRepo(repo)
}

module.exports = fsRepo
