#! /usr/bin/env node

'use strict'

const cluster = require('cluster')

if (cluster.isWorker) {
  require('./worker')
} else {
  require('./master')
}
