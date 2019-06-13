'use strict'

const log = require('ipfs-registry-mirror-common/utils/log')
const {
  Advertisement
} = require('dnssd')

const advertise = async (ipfs, config) => {
  if (!config.mdns.enabled) {
    return () => {}
  }

  log(`📣 Starting mDNS advert for ${config.mdns.name} on port ${config.ipfs.port}`)

  const advertisment = new Advertisement(config.mdns.name, config.ipfs.port, {
    txt: {
      id: (await ipfs.id()).id
    }
  })
  advertisment.start()
  advertisment.on('error', err => {
    console.error(`💥 DNSSD Error: ${err}`) // eslint-disable-line no-console
  })

  return () => {
    advertisment.stop()
  }
}

module.exports = advertise
