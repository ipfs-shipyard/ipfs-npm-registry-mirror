'use strict'

const S3 = require('aws-sdk/clients/s3')

module.exports = ({ ipfs: { store, s3: { bucket, region, accessKeyId, secretAccessKey } }, follow: { seqFile } }) => {
  if (store !== 's3') {
    console.info('📁 Using fs sequence file') // eslint-disable-line no-console
    return undefined
  }

  console.info('☁️  Using s3 sequence file') // eslint-disable-line no-console

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
          console.error(`💥 Could not load seq file from ${seqFile} - ${err}`) // eslint-disable-line no-console
          return callback(0)
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
