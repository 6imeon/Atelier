# Stage 1: Build
FROM node:22.12-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY packages/sdk/package.json packages/sdk/
COPY packages/web-ui/package.json packages/web-ui/

RUN npm ci --workspace=packages/sdk --workspace=packages/web-ui --include-workspace-root

COPY packages/sdk/src packages/sdk/src
COPY packages/sdk/tsconfig.json packages/sdk/

COPY packages/web-ui/src packages/web-ui/src
COPY packages/web-ui/tsconfig.json packages/web-ui/
COPY packages/web-ui/vite.config.ts packages/web-ui/
COPY packages/web-ui/tailwind.config.ts packages/web-ui/
COPY packages/web-ui/index.html packages/web-ui/

# Copy .env for VITE_* build-time substitution (baked into bundle, not carried into final nginx image)
COPY .env* ./

RUN npx turbo run build --filter=@canvas-ai/web-ui

# Stage 2: Serve with nginx
FROM nginx:1.27-alpine

COPY packages/web-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/web-ui/dist /usr/share/nginx/html

EXPOSE 80
