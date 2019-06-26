'use strict'

const {
  AbstractLevelDOWN,
  AbstractIterator
} = require('abstract-leveldown')
const mortice = require('mortice')

const handle = (resolve, reject) => {
  return (err, res) => {
    if (err) {
      return reject(err)
    }

    resolve(res)
  }
}

class LevelLock extends AbstractLevelDOWN {
  constructor (db, opts) {
    super(db, opts)

    this.db = db
    this.opts = opts || {}
    this.mutex = mortice(this.opts.lock || 'level-lock')
  }

  _open (options, callback) {
    this.db.open(options, callback)
  }

  _close (callback) {
    this.db.close(callback)
  }

  _put (key, value, options, callback) {
    this.mutex.writeLock(() => {
      return new Promise((resolve, reject) => {
        this.db.put(key, value, options, handle(resolve, reject))
      })
        .then(res => callback(null, res), callback)
    })
  }

  _get (key, options, callback) {
    this.mutex.readLock(() => {
      return new Promise((resolve, reject) => {
        this.db.get(key, options, handle(resolve, reject))
      })
        .then(res => callback(null, res), callback)
    })
  }

  _del (key, options, callback) {
    this.mutex.writeLock(() => {
      return new Promise((resolve, reject) => {
        this.db.del(key, options, handle(resolve, reject))
      })
        .then(res => callback(null, res), callback)
    })
  }

  _batch (operations, options, callback) {
    this.mutex.writeLock(() => {
      return new Promise((resolve, reject) => {
        this.db.batch(operations, options, handle(resolve, reject))
      })
        .then(res => callback(null, res), callback)
    })
  }

  _serializeKey (key) {
    if (this.db._serializeKey) {
      return this.db._serializeKey(key)
    }

    return key
  }

  _serializeValue (value) {
    if (this.db._serializeValue) {
      return this.db._serializeValue(value)
    }

    return value
  }

  _iterator (options) {
    return new LevelLockIterator(this, options)
  }
}

class LevelLockIterator extends AbstractIterator {
  constructor (db, options) {
    super(db, options)

    this.mutex = db.mutex
    this.iter = db.db.iterator(options)
  }

  _next (callback) {
    this.mutex.readLock((cb) => {
      this.iter.next((err, value) => {
        cb()
        callback(err, value)
      })
    })
  }

  _seek (target) {
    this.mutex.readLock((cb) => {
      this.iter.seek(target)
      cb()
    })
  }

  _end (callback) {
    this.iter.end(callback)
  }
}

module.exports = LevelLock
