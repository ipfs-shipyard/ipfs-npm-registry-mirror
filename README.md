<p align="center">
  <img src="https://github.com/ipfs-shipyard/ipfs-npm-registry-mirror/raw/master/img/npm-on-ipfs.svg?sanitize=true" alt="npm on IPFS logo" width="256" />
</p>

# ipfs-npm-registry-mirror

[![](https://img.shields.io/badge/made%20by-Protocol%20Labs-blue.svg?style=flat-square)](https://protocol.ai)
[![](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](http://ipfs.io/)
[![](https://img.shields.io/badge/freenode-%23ipfs-blue.svg?style=flat-square)](http://webchat.freenode.net/?channels=%23ipfs)
[![Build Status](https://flat.badgen.net/travis/ipfs-shipyard/ipfs-npm-registry-mirror)](https://travis-ci.com/ipfs-shipyard/ipfs-npm-registry-mirror)
[![Code Coverage](https://codecov.io/gh/ipfs-shipyard/ipfs-npm-registry-mirror/branch/master/graph/badge.svg)](https://codecov.io/gh/ipfs-shipyard/ipfs-npm-registry-mirror)
[![Dependency Status](https://david-dm.org/ipfs-shipyard/ipfs-npm-registry-mirror.svg?style=flat-square)](https://david-dm.org/ipfs-shipyard/ipfs-npm-registry-mirror)

> A npm mirror that adds files to IPFS and makes them available over the distributed web!

## Usage

```console
# with docker installed
$ git clone https://github.com/ipfs-shipyard/ipfs-npm-registry-mirror.git
$ cd ipfs-npm-registry-mirror
$ ./deploy.sh
```

## Overview

There are two docker images, a [replication-master](./packages/replication-master/README.md) which continually syncs the npm registry and all of it's packages and a [registry-mirror](./packages/registry-mirror/README.md) which serves files to clients.

The replication-master publishes notifications of new packages to the mirrors via [pubsub](https://ipfs.io/blog/25-pubsub/), they then save the [CID](https://www.npmjs.com/package/cids)s of newly published modules and use them to resolve them on the IPFS network.

You can can either use the [public http mirror](https://registry.js.ipfs.io) with npm/yarn (e.g. pass `--registry=https://registry.js.ipfs.io` to npm or yarn) or use the [`ipfs-npm`](https://www.npmjs.com/package/ipfs-npm) client directly.

## Lead Maintainer

[Alex Potsides](https://github.com/achingbrain)


## Deployment

Requirements:

* Docker
* docker-compose `v1.24.0-rc1` or later.

```
$ git clone https://github.com/ipfs-shipyard/ipfs-npm-registry-mirror.git
$ cd ipfs-npm-registry-mirror
$ echo NODE_ENV=production > .env
$ ./deploy.sh
```


```yml
version: '2'

services:

  proxy:
    image: jwilder/nginx-proxy:alpine
    mem_limit: 1024m
    links:
      - replicate
      - registry
    ports:
      - '80:80'
      - '443:443'
    logging:
      driver: "json-file"
      options:
        max-size: "1m"
        max-file: "3"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - /etc/nginx/vhost.d
      - /usr/share/nginx/html
      - /etc/nginx/certs
      - ./conf/proxy.conf:/etc/nginx/proxy.conf
    restart: 'always'

  replicate:
    build:
      context: .
      dockerfile: packages/replication-master/Dockerfile
    restart: 'always'
    env_file: .env
    mem_limit: 4608m
    environment:
      - VIRTUAL_HOST=replication.rig.home
      - VIRTUAL_PORT=8080
      - NODE_ENV=${NODE_ENV}
      - EXTERNAL_PROTOCOL=http
      - EXTERNAL_HOST=rig.home
      - EXTERNAL_PORT=80
      - EXTERNAL_IP=192.168.1.112
      - IPFS_STORE_TYPE=fs
      - IPFS_REPO=/usr/local/ipfs-npm-registry-mirror/replication-master
      - FOLLOW_SEQ_FILE=/usr/local/ipfs-npm-registry-mirror/seq.txt
      - CLONE_DELAY=30000
      - FOLLOW_CONCURRENCY=5
      - REQUEST_CONCURRENCY=5
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - /usr/local/ipfs-npm-registry-mirror:/usr/local/ipfs-npm-registry-mirror
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"

  registry:
    build:
      context: .
      dockerfile: packages/registry-mirror/Dockerfile
    restart: 'always'
    env_file: .env
    mem_limit: 2048m
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
    environment:
      - VIRTUAL_HOST=rig.home
      - VIRTUAL_PORT=8080
      - NODE_ENV=${NODE_ENV}
      - EXTERNAL_PROTOCOL=http
      - EXTERNAL_HOST=rig.home
      - EXTERNAL_PORT=80
      - EXTERNAL_IP=192.168.1.112
      - IPFS_STORE_TYPE=fs
      - IPFS_REPO=/usr/local/ipfs-npm-registry-mirror/worker
      - PUBSUB_MASTER=http://replicate:8080
      - REQUEST_MAX_SOCKETS=20
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - /usr/local/ipfs-npm-registry-mirror:/usr/local/ipfs-npm-registry-mirror
    links:
      - replicate
    ports:
      - "10000:10000"
      - "10001:10001"
      - "10002:10002"
      - "10003:10003"
      - "10004:10004"
      - "10005:10005"
      - "10006:10006"
      - "10007:10007"
      - "10008:10008"
      - "10009:10009"
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"
```