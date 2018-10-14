# ipfs-registry-mirror

![Alt text](./img/npm-on-ipfs.svg)

[![](https://img.shields.io/badge/made%20by-Protocol%20Labs-blue.svg?style=flat-square)](https://protocol.ai)
[![](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](http://ipfs.io/)
[![](https://img.shields.io/badge/freenode-%23ipfs-blue.svg?style=flat-square)](http://webchat.freenode.net/?channels=%23ipfs)
[![Build Status](https://ci.ipfs.team/buildStatus/icon?job=IPFS%20Shipyard/ipfs-registry-mirror/master)](https://ci.ipfs.team/job/IPFS%20Shipyard/job/ipfs-registry-mirror/job/master/)
[![Code Coverage](https://codecov.io/gh/ipfs-shipyard/ipfs-registry-mirror/branch/master/graph/badge.svg)](https://codecov.io/gh/ipfs-shipyard/ipfs-registry-mirror)
[![Dependency Status](https://david-dm.org/ipfs-shipyard/ipfs-registry-mirror.svg?style=flat-square)](https://david-dm.org/ipfs-shipyard/ipfs-registry-mirror)

> A npm mirror that adds files to IPFS and makes them available over the distributed web!

## Usage

```console
# with docker installed
$ git clone https://github.com/ipfs-shipyard/ipfs-registry-mirror.git
$ cd ipfs-registry-mirror
$ ./deploy.sh
```

## Overview

There are two docker images, a [replication-master](./packages/replication-master/README.md) which continually syncs the npm registry and all of it's packages and a [registry-mirror](./packages/registry-mirror/README.md) which serves files to clients.

The replication-master publishes notifications of new packages to the mirrors via [pubsub](https://ipfs.io/blog/25-pubsub/), they then save the [CID](https://www.npmjs.com/package/cids)s of newly published modules and use them to resolve them on the IPFS network.

You can can either use the [public http mirror](https://registry.js.ipfs.io) with npm/yarn (e.g. pass `--registry=https://registry.js.ipfs.io` to npm or yarn) or use the [`ipfs-npm`](https://www.npmjs.com/package/ipfs-npm) client directly.

## Lead Maintainer

[Alex Potsides](https://github.com/achingbrain)
