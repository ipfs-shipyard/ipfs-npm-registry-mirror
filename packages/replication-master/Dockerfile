FROM node:10

EXPOSE 8080
EXPOSE 4001
EXPOSE 4002
EXPOSE 5001
EXPOSE 9090

RUN export NODE_ENV=production
RUN npm set unsafe-perm true

COPY ./package.json /app/package.json
COPY ./lerna.json /app/lerna.json
COPY ./packages/common/package.json /app/packages/common/package.json
COPY ./packages/replication-master/package.json /app/packages/replication-master/package.json

WORKDIR /app

RUN npm install --production

COPY ./packages/common/utils /app/packages/common/utils
COPY ./packages/common/handlers /app/packages/common/handlers
COPY ./packages/common/server.js /app/packages/common/server.js
COPY ./packages/replication-master/src /app/packages/replication-master/src

WORKDIR /app/packages/replication-master

CMD node --max-old-space-size=4096 .
