# Atelier — Setup & Running

## Prerequisites

- Node.js 20+
- npm 10+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for full stack)

---

## Quick Start (UI only, no API key needed)

The web UI runs standalone — you can explore the canvas, pan, zoom, and interact with the chat panel without an OpenRouter key. Generation will fail gracefully until you add a key.

```bash
npm install
cd packages/web-ui
npx vite
```

Open **http://localhost:5173**.

---

## Full Stack (Native)

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY

# 2. Build the SDK first (API server depends on it)
cd packages/sdk && npx tsc

# 3. Start the API server (terminal 1)
cd packages/api-server && npx tsx src/index.ts

# 4. Start the web UI (terminal 2)
cd packages/web-ui && npx vite
```

Or use Turbo from root: `npm run dev` (requires SDK build first).

The API server runs on **http://localhost:8080** and the web UI proxies `/api` requests to it automatically.

---

## Docker (Recommended)

### Development

Start the backend in Docker, run the frontend natively for fast HMR:

```bash
docker compose up --build -d    # crawl4ai + api-server
npm run ui:dev                  # Vite dev server
```

### Production

Run everything in Docker including the web UI:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

### Services

| Service | Port | Purpose |
|---------|------|---------|
| crawl4ai | 11235 | Headless browser web crawler |
| api-server | 8080 | REST API + AI pipeline |
| web-ui | 80 | nginx serving React app (prod only) |

### Architecture

```
                    ┌──────────────────┐
  Browser (:5173)   │  Vite Dev Server │  ← Dev only
                    └────────┬─────────┘
                             │ /api proxy
                    ┌────────▼─────────┐
  Browser (:80)  →  │   nginx (prod)   │  ← Prod only
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   API Server     │  :8080
                    │   (Node.js)      │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │    crawl4ai      │  :11235
                    │ (headless browser)│
                    └──────────────────┘
```

### Data Persistence

SQLite database is stored in a Docker named volume `canvas-data` mounted at `/data`.

```bash
# Back up
docker cp $(docker compose ps -q api-server):/data/canvas.db ./backup.db

# Reset
docker compose down -v
```

### Environment Variables

All env vars from `.env` are injected into the API server. Docker Compose also sets:

| Variable | Value | Purpose |
|----------|-------|---------|
| `CRAWL4AI_URL` | `http://crawl4ai:11235` | crawl4ai service URL |
| `ATELIER_STORAGE` | `sqlite` | Use persistent storage |
| `ATELIER_STORAGE_PATH` | `/data/canvas.db` | SQLite file path |

### Common Docker Commands

```bash
docker compose up -d                  # Start dev backend
docker compose logs -f api-server     # View API logs
docker compose up --build -d          # Rebuild after code changes
docker compose down                   # Stop everything
docker compose down -v                # Stop and delete data
docker compose ps                     # Check service health
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Red dots in VS Code | Run `npm install`, then Cmd+Shift+P → "TypeScript: Restart TS Server" |
| Port 5173 in use | `npx vite --port 3000` |
| Port 8080 in use | `PORT=9090 npx tsx src/index.ts` |
| `Cannot find module` | Run `npm install` from project root |
| API calls fail | Ensure api-server is running and `.env` has your OpenRouter key |
| crawl4ai won't start | Needs ~4GB RAM. Check Docker Desktop Settings > Resources |
| API can't reach crawl4ai | crawl4ai health check may be slow on first run (downloads browser). Increase `start_period` in docker-compose.yml |
| Build fails on better-sqlite3 | Dockerfile includes `python3 make g++`. Check Docker platform matches your CPU arch |
