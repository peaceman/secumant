# syntax=docker/dockerfile:1
ARG NODE_BASE_IMAGE=node:16.13-alpine3.12
FROM ${NODE_BASE_IMAGE}

RUN apk add --no-cache tini \
    && wget -qO- https://raw.githubusercontent.com/eficode/wait-for/v2.1.3/wait-for > /usr/local/bin/wait-for \
    && chmod +x /usr/local/bin/wait-for

USER node
WORKDIR /app

COPY package*.json ./
RUN yarn install

COPY bin ./bin/
COPY config ./config/
COPY migrations ./migrations/
COPY src ./src/
COPY knexfile.js ./

ENTRYPOINT [ "/sbin/tini", "--", "node", "bin/secumant" ]
