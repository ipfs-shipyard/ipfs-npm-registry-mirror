'use strict'

const pkg = require('../../package')
const cluster = require('cluster')

process.title = `${pkg.name}-worker-${cluster.worker.id}`

require('../core/clone/cluster-worker')
