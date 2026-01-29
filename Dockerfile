# Multi-stage Dockerfile for building and deploying the game

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies for all packages
FROM base AS deps
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm install

# Build shared types
FROM base AS build-shared
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY shared ./shared
WORKDIR /app/shared
RUN npm run build

# Build client
FROM base AS build-client
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY --from=build-shared /app/shared ./shared
COPY client ./client
WORKDIR /app/client
RUN npm run build

# Build server
FROM base AS build-server
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY --from=build-shared /app/shared ./shared
COPY server ./server
WORKDIR /app/server
RUN npm run build && ls -la dist/

# Production image
FROM node:20-alpine AS production
WORKDIR /app

# Copy root package files for workspace setup
COPY package*.json ./

# Copy shared package (both dist and package.json)
COPY --from=build-shared /app/shared/dist ./shared/dist
COPY --from=build-shared /app/shared/package.json ./shared/

# Copy server build
COPY --from=build-server /app/server/dist ./server/dist
COPY --from=build-server /app/server/package*.json ./server/

# Copy client package.json (needed for workspace resolution)
COPY client/package.json ./client/

# Copy client build to be served by the server
COPY --from=build-client /app/client/dist ./server/public

# Install all workspace dependencies (needed for proper linking)
RUN npm install --production

# Debug: Check what files exist
RUN echo "=== Root directory ===" && ls -la && \
    echo "=== Node modules ===" && ls -la node_modules/.bin/ 2>/dev/null || echo "No bin" && \
    echo "=== Server directory ===" && ls -la server/ && \
    echo "=== Server dist directory ===" && ls -la server/dist/ && \
    echo "=== Server node_modules ===" && ls -la server/node_modules/@game/ 2>/dev/null || echo "No @game" && \
    echo "=== Shared directory ===" && ls -la shared/ && \
    echo "=== Shared dist directory ===" && ls -la shared/dist/ && \
    echo "=== Shared dist/index.js contents ===" && cat shared/dist/index.js && \
    echo "=== Shared dist files ===" && ls -la shared/dist/

# Set working directory to server
WORKDIR /app/server

EXPOSE 8080

CMD ["node", "dist/index.js"]
