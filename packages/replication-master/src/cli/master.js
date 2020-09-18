'use strict'

const log = require('ipfs-registry-mirror-common/utils/log')
const os = require('os')

if (process.env.NODE_ENV !== 'production' || process.env.PROFILING) {
  const url = '/-/dashboard'

  log(`🔍 Enabling profiling at ${url}`)

  try {
    require('appmetrics-dash').attach({
      url
    })
  } catch (error) {
    log('💥 Enabling profiling failed', error)
  }
}

require('dnscache')({ enable: true })

const pkg = require('../../package')
const path = require('path')

require('dotenv').config({
  path: path.join(process.env.HOME, '.ipfs-npm-registry-mirror/replication-master.env')
})

process.title = pkg.name

const yargs = require('yargs')

yargs.command('$0', 'Starts a registry server that uses IPFS to fetch js dependencies', (yargs) => { // eslint-disable-line no-unused-expressions
  yargs
    .option('registry', {
      describe: 'Which registry we are mirroring',
      default: 'https://registry.npmjs.com'
    })
    .option('registry-update-interval', {
      describe: 'Only request the manifest for a given module every so many ms',
      default: 60000
    })

    .option('http-protocol', {
      describe: 'Which protocol to use with the server',
      default: 'http'
    })
    .option('http-host', {
      describe: 'Which host to listen to requests on',
      default: 'localhost'
    })
    .option('http-port', {
      describe: 'Which port to listen to requests on',
      default: 8080
    })

    .option('external-ip', {
      describe: 'Which IP address to use when reaching this mirror'
    })
    .option('external-protocol', {
      describe: 'Which protocol to use when reaching this mirror'
    })
    .option('external-host', {
      describe: 'Which host to use when reaching this mirror'
    })
    .option('external-port', {
      describe: 'Which port to use when reaching this mirror'
    })

    .option('ipfs-port', {
      describe: 'Which port to accept IPFS connections on',
      default: 4001
    })
    .option('ipfs-mfs-prefix', {
      describe: 'Which mfs prefix to use',
      default: '/npm-registry'
    })
    .option('ipfs-flush', {
      describe: 'Whether to flush the MFS cache',
      default: true
    })
    .option('ipfs-repo', {
      describe: 'The path to the IPFS repo you wish to use',
      default: path.join(process.env.HOME, '.jsipfs')
    })
    .option('ipfs-repo-port', {
      describe: 'The port for level workers to connect to',
      default: 9000
    })
    .option('ipfs-store-type', {
      describe: 'Which type of datastore to use - fs, s3, etc',
      default: 'fs'
    })
    .option('ipfs-store-s3-region', {
      describe: 'The s3 region to use'
    })
    .option('ipfs-store-s3-bucket', {
      describe: 'The s3 bucket to use'
    })
    .option('ipfs-store-s3-path', {
      describe: 'The path to use in an s3 bucket'
    })
    .option('ipfs-store-s3-access-key-id', {
      describe: 'The s3 access key id to use'
    })
    .option('ipfs-store-s3-secret-access-key', {
      describe: 'The s3 secret access key id to use'
    })
    .option('ipfs-store-s3-create-if-missing', {
      describe: 'Whether to create the bucket if it is missing',
      default: false
    })
    .option('ipfs-pass', {
      describe: 'Used to secure operations on the keystore - must be over 20 characters long'
    })

    .option('follow-replicator', {
      describe: 'Where to get changes from',
      default: 'https://replicate.npmjs.com/registry/_changes'
    })
    .option('follow-registry', {
      describe: 'Which registry to clone',
      default: 'https://registry.npmjs.com'
    })
    .option('follow-user-agent', {
      describe: 'What user agent to specify when contacting the registry',
      default: 'IPFS replication-master'
    })
    .option('follow-concurrency', {
      describe: 'How many registry updates to process at once',
      default: 10
    })
    .option('follow-seq-file', {
      describe: 'Where to store the seq file of how far through the npm feed we are',
      default: 'seq.txt'
    })
    .options('follow-inactivity-ms', {
      describe: 'If no updates are received in this time, restart the feed',
      default: 1800000
    })

    .option('clone-delay', {
      describe: 'How long to wait after startup before starting to clone npm',
      default: 0
    })
    .option('clone-pin', {
      describe: 'Whether to pin cloned modules',
      default: false
    })
    .option('clone-publish', {
      describe: 'Whether to publish IPNS names for cloned modules',
      default: false
    })
    .option('clone-concurrency', {
      describe: 'How many cluster workers to use to process module updates',
      default: os.cpus().length - 1
    })

    .option('request-retries', {
      describe: 'How many times to retry when downloading tarballs from the registry',
      default: 5
    })
    .option('request-retry-delay', {
      describe: 'How long in ms to wait between retries',
      default: 1000
    })
    .option('request-timeout', {
      describe: 'How long in ms we should wait when requesting files',
      default: 30000
    })
    .option('request-keep-alive', {
      describe: 'Whether to re-use connections',
      default: true
    })
    .option('request-concurrency', {
      describe: 'How many simultaneous requests to make',
      default: 50
    })

    .option('mdns-advert', {
      describe: 'A string name to use to advertise this service over mDNS',
      default: '_ipfs-npm._tcp'
    })
}, require('../core'))
  .argv
