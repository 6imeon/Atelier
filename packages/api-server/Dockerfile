# Stage 1: Install dependencies and build
FROM node:22.12-alpine AS builder

WORKDIR /app

# Copy workspace config files first for layer caching
COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY packages/sdk/package.json packages/sdk/
COPY packages/api-server/package.json packages/api-server/

# Install dependencies (--ignore-scripts skips husky prepare + native builds)
# Then manually rebuild better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++ && \
    npm ci --workspace=packages/sdk --workspace=packages/api-server --include-workspace-root --ignore-scripts && \
    npm rebuild better-sqlite3

# Copy source files
COPY packages/sdk/src packages/sdk/src
COPY packages/sdk/tsconfig.json packages/sdk/

COPY packages/api-server/src packages/api-server/src
COPY packages/api-server/tsconfig.json packages/api-server/

# Build SDK first, then API server
RUN npx turbo run build --filter=@canvas-ai/api-server

# Stage 2: Production image (Debian for Playwright Chromium support)
FROM node:22.12-slim

WORKDIR /app

# Install Playwright system dependencies + build tools for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/sdk/package.json packages/sdk/
COPY packages/api-server/package.json packages/api-server/

RUN npm ci --workspace=packages/sdk --workspace=packages/api-server --include-workspace-root --omit=dev --ignore-scripts && \
    npm rebuild better-sqlite3

# Install Playwright Chromium browser + all system dependencies
RUN npx playwright install --with-deps chromium

# Copy built artifacts
COPY --from=builder /app/packages/sdk/dist packages/sdk/dist
COPY --from=builder /app/packages/api-server/dist packages/api-server/dist

# Copy seed components, personas, and skeleton library
COPY scripts/components.json scripts/components.json
COPY scripts/components-cinematic.json scripts/components-cinematic.json
COPY scripts/personas scripts/personas
COPY scripts/skeletons scripts/skeletons

# Create data directory for SQLite
RUN mkdir -p /data

EXPOSE 8080

CMD ["node", "packages/api-server/dist/index.js"]
