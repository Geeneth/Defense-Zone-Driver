# Multi-stage Dockerfile for building and deploying the game

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies for all packages
FROM base AS deps
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm install -w shared -w server -w client

# Build shared types
FROM base AS build-shared
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY shared ./shared
WORKDIR /app/shared
RUN npm run build

# Build client
FROM base AS build-client
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/client/node_modules ./client/node_modules
COPY --from=build-shared /app/shared ./shared
COPY client ./client
WORKDIR /app/client
RUN npm run build

# Build server
FROM base AS build-server
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=build-shared /app/shared ./shared
COPY server ./server
WORKDIR /app/server
RUN npm run build

# Production image
FROM node:20-alpine AS production
WORKDIR /app

# Copy shared package
COPY --from=build-shared /app/shared/dist ./shared/dist
COPY --from=build-shared /app/shared/package.json ./shared/

# Copy server build and dependencies
COPY --from=build-server /app/server/dist ./server/dist
COPY --from=build-server /app/server/package*.json ./server/
COPY --from=deps /app/server/node_modules ./server/node_modules

# Copy client build to be served by the server
COPY --from=build-client /app/client/dist ./server/public

# Copy root package.json
COPY package*.json ./

# Set working directory to server
WORKDIR /app/server

EXPOSE 8080

CMD ["node", "dist/index.js"]
