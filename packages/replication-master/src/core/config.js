'use strict'

const toBoolean = require('ipfs-registry-mirror-common/utils/to-boolean')
const option = require('ipfs-registry-mirror-common/utils/option')

module.exports = (overrides = {}) => {
  return {
    registries: [option(process.env.REGISTRY, overrides.registry)],
    registryUpdateInterval: option(process.env.REGISTRY_UPDATE_INTERVAL, overrides.registryUpdateInterval),
    registryReadTimeout: option(Number(process.env.REGISTRY_READ_TIMEOUT), overrides.registryReadTimeout),

    http: {
      protocol: option(process.env.HTTP_PROTOCOL, overrides.httpProtocol),
      host: option(process.env.HTTP_HOST, overrides.httpHost),
      port: option(Number(process.env.HTTP_PORT), overrides.httpPort)
    },

    external: {
      ip: option(process.env.EXTERNAL_IP, overrides.externalIp),
      protocol: option(process.env.EXTERNAL_PROTOCOL, overrides.externalProtocol),
      host: option(process.env.EXTERNAL_HOST, overrides.externalHost),
      port: option(process.env.EXTERNAL_PORT, overrides.externalPort)
    },

    ipfs: {
      pass: option(process.env.IPFS_PASS, overrides.ipfsPass),
      node: option(process.env.IPFS_NODE, overrides.ipfsNode),
      port: option(process.env.IPFS_SWARM_PORT, overrides.ipfsPort),
      prefix: option(process.env.IPFS_MFS_PREFIX, overrides.ipfsMfsPrefix),
      flush: option(toBoolean(process.env.IPFS_FLUSH), overrides.ipfsFlush),
      store: option(process.env.IPFS_STORE_TYPE, overrides.ipfsStoreType),

      s3: {
        region: option(process.env.STORE_S3_REGION, overrides.ipfsStoreS3Region),
        bucket: option(process.env.STORE_S3_BUCKET, overrides.ipfsStoreS3Bucket),
        path: option(process.env.STORE_S3_PATH, overrides.ipfsStoreS3Path),
        accessKeyId: option(process.env.STORE_S3_ACCESS_KEY_ID, overrides.ipfsStoreS3AccessKeyId),
        secretAccessKey: option(process.env.STORE_S3_SECRET_ACCESS_KEY, overrides.ipfsStoreS3SecretAccessKey),
        createIfMissing: option(process.env.STORE_S3_CREATE_IF_MISSING, overrides.ipfsStoreS3CreateIfMissing)
      },

      fs: {
        repo: option(process.env.IPFS_REPO, overrides.ipfsRepo),
        port: option(process.env.IPFS_REPO_PORT, overrides.ipfsRepoPort)
      }
    },

    follow: {
      ua: option(process.env.FOLLOW_USER_AGENT, overrides.followUserAgent),
      registry: option(process.env.FOLLOW_REGISTTRY, overrides.followRegistry),
      replicator: option(process.env.FOLLOW_REPLICATOR, overrides.followReplicator),
      concurrency: option(Number(process.env.FOLLOW_CONCURRENCY), overrides.followConcurrency),
      inactivityTimeout: option(process.env.FOLLOW_INACTIVITY_MS, overrides.followInactivityMs),
      seqFile: option(process.env.FOLLOW_SEQ_FILE, overrides.followSeqFile)
    },

    clone: {
      delay: option(Number(process.env.CLONE_DELAY), overrides.cloneDelay),
      pin: option(Number(process.env.CLONE_PIN), overrides.clonePin),
      publish: option(process.env.CLONE_PUBLISH, overrides.clonePublish),
      concurrency: parseInt(option(process.env.CLONE_CONCCURRENCY, overrides.cloneConcurrency))
    },

    request: {
      retries: option(process.env.REQUEST_RETRIES, overrides.requestRetries),
      retryDelay: option(process.env.REQUEST_RETRY_DELAY, overrides.requestRetryDelay),
      timeout: option(process.env.REQUEST_TIMEOUT, overrides.requestTimeout),
      forever: option(toBoolean(process.env.REQUEST_KEEP_ALIVE), overrides.requestKeepAlive),
      concurrency: parseInt(option(process.env.REQUEST_CONCURRENCY, overrides.requestConcurrency), 10)
    },

    mdns: {
      enabled: Boolean(process.env.MDNS_NAME || overrides.mdnsAdvert),
      name: option(process.env.MDNS_NAME, overrides.mdnsAdvert)
    }
  }
}

module.exports.option = option
module.exports.toBoolean = toBoolean
