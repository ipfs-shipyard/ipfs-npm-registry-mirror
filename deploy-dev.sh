#!/bin/bash -eux

# Build a Docker image
docker-compose build replicate registry

# Shut down the registry containers
docker-compose stop replicate registry

# Restart using the new image
docker-compose up --no-deps proxy replicate registry
