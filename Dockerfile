FROM node:20-bookworm-slim AS web-build
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install --no-save @rollup/rollup-linux-x64-gnu
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS server-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=8080
COPY server/src ./server/src
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY --from=web-build /app/dist ./dist
EXPOSE 8080
CMD ["node", "server/src/index.js"]
