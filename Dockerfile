ARG NODE_VERSION
FROM node:${NODE_VERSION}-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
ARG PART
ARG VERSION
WORKDIR /app
RUN npm install --omit=dev --no-audit --no-fund "@aeolus-fleet/${PART}@${VERSION}"
ENV PATH="/app/node_modules/.bin:${PATH}"
USER node
