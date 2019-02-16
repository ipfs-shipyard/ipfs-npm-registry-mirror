'use strict'

module.exports = (message, error) => {
  const time = new Date()
  const timestamp = time.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })

  if (error) {
    console.error(timestamp, message, error) // eslint-disable-line no-console

    return
  }

  console.info(timestamp, message) // eslint-disable-line no-console
}
