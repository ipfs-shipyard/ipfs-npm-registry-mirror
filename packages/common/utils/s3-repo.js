'use strict'

const { createRepo } = require('datastore-s3')

const s3Repo = ({ region, bucket, path, accessKeyId, secretAccessKey, createIfMissing }) => {
  if (process.env.NODE_ENV === 'development') {
    path = `${path}-test`
  }

  console.info(`☁️  Using s3 storage ${region}:${bucket}/${path}`) // eslint-disable-line no-console

  return createRepo({
    path,
    createIfMissing
  }, {
    bucket,
    region,
    accessKeyId,
    secretAccessKey
  })
}

module.exports = s3Repo
