# syntax=docker/dockerfile:1
ARG NODE_BASE_IMAGE=node:17-alpine3.12
FROM ${NODE_BASE_IMAGE}

RUN apk add --no-cache tini

WORKDIR /app

USER node
COPY package*.json ./
RUN npm ci --only=production

COPY bin ./bin/
COPY config ./config/
COPY migrations ./migrations/
COPY src ./src/
COPY knexfile.js ./

ENTRYPOINT [ "/sbin/tini", "--", "node", "bin/secumant" ]
