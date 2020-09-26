'use strict'

const S3 = require('aws-sdk/clients/s3')
const log = require('ipfs-registry-mirror-common/utils/log')
const fs = require('fs-extra')

module.exports = ({ ipfs: { store, s3: { bucket, region, accessKeyId, secretAccessKey } }, follow: { seqFile } }) => {
  if (store !== 's3') {
    log('📁 Using fs sequence file', seqFile)
    return {
      async read () { // eslint-disable-line require-await
        try {
          return fs.readFile(seqFile, 'utf8')
        } catch (err) {
          log(err)
          return 0
        }
      },
      async write (data) {
        await fs.writeFile(seqFile, data, 'utf8')
      },
      async reset () {
        await fs.unlink(seqFile)
      }
    }
  }

  log('☁️  Using s3 sequence file', seqFile)

  const s3 = new S3({
    params: {
      Bucket: bucket
    },
    region,
    accessKeyId,
    secretAccessKey
  })

  return {
    async read () {
      try {
        const data = await s3.getObject({
          Key: seqFile
        }).promise()

        const seq = data.Body.toString('utf8')

        return parseInt(seq, 10)
      } catch (err) {
        log(`💥 Could not load seq file from ${seqFile}`, err)

        return 0
      }
    },
    async write (data) {
      try {
        await s3.putObject({
          Key: seqFile,
          Body: `${data}`
        }).promise()
      } catch (err) {
        log(`💥 Could not write seq file to ${seqFile}`, err)
      }
    },
    async reset () {
      try {
        await s3.deleteObject({
          Key: seqFile
        }).promise()
      } catch (err) {
        log(`💥 Could not reset seq file at ${seqFile}`, err)
      }
    }
  }
}
