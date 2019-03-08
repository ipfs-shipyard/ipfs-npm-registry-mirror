FROM node:10

EXPOSE 8080
EXPOSE 10000-10009

RUN export NODE_ENV=production
RUN npm set unsafe-perm true

COPY ./package.json /app/package.json
COPY ./package-lock.json /app/package-lock.json
COPY ./lerna.json /app/lerna.json
COPY ./packages/common/package.json /app/packages/common/package.json
COPY ./packages/common/package-lock.json /app/packages/common/package-lock.json
COPY ./packages/registry-mirror/package.json /app/packages/registry-mirror/package.json
COPY ./packages/registry-mirror/package-lock.json /app/packages/registry-mirror/package-lock.json

WORKDIR /app

RUN npm install --production

COPY ./packages/common/utils /app/packages/common/utils
COPY ./packages/common/handlers /app/packages/common/handlers
COPY ./packages/common/server.js /app/packages/common/server.js
COPY ./packages/registry-mirror/src /app/packages/registry-mirror/src

WORKDIR /app/packages/registry-mirror

CMD node .
