'use strict'

const S3 = require('aws-sdk/clients/s3')
const log = require('ipfs-registry-mirror-common/utils/log')

module.exports = ({ ipfs: { store, s3: { bucket, region, accessKeyId, secretAccessKey } }, follow: { seqFile } }) => {
  if (store !== 's3') {
    log('📁 Using fs sequence file')
    return undefined
  }

  log('☁️  Using s3 sequence file')

  const s3 = new S3({
    params: {
      Bucket: bucket
    },
    region,
    accessKeyId,
    secretAccessKey
  })

  return {
    read: (callback) => {
      s3.getObject({
        Key: seqFile
      }, (err, data) => {
        if (err) {
          log(`💥 Could not load seq file from ${seqFile} - ${err}`)
          return callback(0) // eslint-disable-line standard/no-callback-literal
        }

        const seq = data.Body.toString('utf8')

        return callback(parseInt(seq, 10))
      })
    },
    write: (data, callback) => {
      s3.putObject({
        Key: seqFile,
        Body: data.toString()
      }, callback)
    },
    rm: (callback) => {
      s3.deleteObject({
        Key: seqFile
      }, callback)
    }
  }
}
