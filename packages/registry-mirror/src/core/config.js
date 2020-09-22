'use strict'

const toBoolean = require('ipfs-registry-mirror-common/utils/to-boolean')
const option = require('ipfs-registry-mirror-common/utils/option')

module.exports = (overrides = {}) => {
  return {
    registries: (overrides.registries || []).concat(option(process.env.REGISTRY, overrides.registry)).filter(Boolean),
    registryUpdateInterval: option(process.env.REGISTRY_UPDATE_INTERVAL, overrides.registryUpdateInterval),
    registryUploadSizeLimit: option(process.env.MIRROR_UPLOAD_SIZE_LIMIT, overrides.registryUploadSizeLimit),
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
      port: option(process.env.IPFS_SWARM_PORT, overrides.ipfsPort),
      prefix: option(process.env.IPFS_MFS_PREFIX, overrides.ipfsMfsPrefix),
      flush: option(toBoolean(process.env.IPFS_FLUSH), overrides.ipfsFlush),
      store: option(process.env.IPFS_STORE_TYPE, overrides.ipfsStoreType),

      s3: {
        region: option(process.env.STORE_S3_REGION, overrides.storeS3Region),
        bucket: option(process.env.STORE_S3_BUCKET, overrides.storeS3Bucket),
        path: option(process.env.STORE_S3_PATH, overrides.storeS3Path),
        accessKeyId: option(process.env.STORE_S3_ACCESS_KEY_ID, overrides.storeS3AccessKeyId),
        secretAccessKey: option(process.env.STORE_S3_SECRET_ACCESS_KEY, overrides.storeS3SecretAccessKey),
        createIfMissing: option(process.env.STORE_S3_CREATE_IF_MISSING, overrides.createIfMissing)
      },

      fs: {
        repo: option(process.env.IPFS_REPO, overrides.ipfsRepo),
        port: option(process.env.IPFS_REPO_PORT, overrides.ipfsRepoPort)
      }
    },

    pubsub: {
      master: option(process.env.PUBSUB_MASTER, overrides.pubsubMaster)
    },

    clone: {
      pin: option(Number(process.env.CLONE_PIN), overrides.clonePin)
    },

    request: {
      retries: option(process.env.REQUEST_RETRIES, overrides.requestRetries),
      retryDelay: option(process.env.REQUEST_RETRY_DELAY, overrides.requestRetryDelay),
      timeout: option(process.env.REQUEST_TIMEOUT, overrides.requestTimeout),
      forever: option(toBoolean(process.env.REQUEST_KEEP_ALIVE), overrides.requestKeepAlive),
      pool: {
        maxSockets: option(Number(process.env.REQUEST_MAX_SOCKETS), overrides.requestMaxSockets)
      }
    }
  }
}

module.exports.option = option
module.exports.toBoolean = toBoolean
