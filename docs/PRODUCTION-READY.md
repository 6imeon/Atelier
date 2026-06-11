# Atelier — Production Readiness Checklist

A punch list for taking Atelier from local-dev-split-stack to a single `docker compose up` that stands up the whole app in a production-ish posture.

## Current state (as of 2026-04-24)

- API stack runs in Docker (`docker compose up`): `crawl4ai` + `api-server` (SQLite on a named volume) + optional MongoDB (external).
- **Web UI runs outside Docker** via `npm run dev --workspace=packages/web-ui` (Vite dev server on :5173).
- A `docker-compose.prod.yml` exists but only defines the `web-ui` service — it's not a complete override and doesn't merge cleanly with the base file.
- CI: Node 20 in `.github/workflows/ci.yml`; Node 22 in Dockerfiles — version skew.
- Secrets: `.env` is present in repo root (contains `OPENROUTER_API_KEY`). Loaded by the API server directly.
- Auth: apikey + optional Entra ID. Rate limit: in-memory (doesn't survive restart, not multi-instance safe).
- Logs: unstructured `console.log` with `[api]` prefixes. No metrics. No error monitoring.

---

## P0 — Blocks "one command spins up the whole app" — ✅ DONE 2026-04-24

### [x] 1. Consolidate compose files — one `docker compose up` runs everything

- `docker-compose.prod.yml` deleted; single [docker-compose.yml](../docker-compose.yml) now defines `crawl4ai` + `api-server` + `web-ui`.
- `web-ui` depends on `api-server` healthcheck. Ports configurable via env (`WEB_PORT=8090`, `API_PORT=8080`, `CRAWL4AI_PORT=11235`).
- Target achieved: `docker compose up -d` → web UI at `http://localhost:8090/`.

### [x] 2. Rename project + images to Atelier

- Compose project named `atelier` (top-level `name:` field).
- Images: `atelier-api-server:local`, `atelier-web-ui:local`, `unclecode/crawl4ai:0.7.4`.
- Containers: `atelier-api-server`, `atelier-web-ui`, `atelier-crawl4ai`.
- Volume renamed from `canvas-data` to `atelier-data`. Existing data migrated from `canvas-ai_canvas-data` → `atelier_atelier-data` (SQLite DB + assets).

### [x] 3. Skeleton/persona bake strategy

- **Prod posture** (default): baked into image at build time ([packages/api-server/Dockerfile:52-55](../packages/api-server/Dockerfile#L52-L55)). Immutable, reproducible.
- **Dev posture**: a `docker-compose.override.yml` with bind mounts is still optional (not added yet) — current workflow is `docker compose build api-server` on skeleton changes.

### [x] 4. Fix Node version skew

- [.github/workflows/ci.yml](../.github/workflows/ci.yml) now uses Node 22 (matches Dockerfiles).
- Dockerfiles pinned to `node:22.12-alpine` (builder) and `node:22.12-slim` (runtime).

### [x] 5. Secrets management

- Repo is not a git checkout locally; `.env` is listed in [.gitignore](../.gitignore) for when it becomes one.
- `.env.example` covers all vars ([.env.example](../.env.example)).
- Open follow-up (P1): move to Docker secrets for multi-host deployments.

### [x] 6. Pin image versions

- `unclecode/crawl4ai:0.7.4` (was implicit `:latest`).
- `node:22.12-alpine` / `node:22.12-slim` (was `:22-alpine` / `:22-slim`).
- `nginx:1.27-alpine` (was `:alpine`).
- Digest pinning still open as a hardening step.

---

## P1 — Production hardening

### [ ] 6. nginx hardening (`packages/web-ui/nginx.conf`)

- Add `gzip on` (or `brotli`) for text assets.
- Add cache headers on `/assets/*` (`Cache-Control: public, max-age=31536000, immutable`) — Vite hashes filenames.
- Add security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` (or `frame-ancestors` via CSP)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy` (start permissive, tighten — watch out for inline styles from skeletons)
- Raise proxy timeout for SSE endpoints if they exceed the current 120s.
- Disable server tokens (`server_tokens off;`).

### [ ] 7. Resource limits and logging driver

- Add `deploy.resources.limits` (memory + cpu) per service in compose.
- Add `logging.driver: json-file` with `max-size` and `max-file` to prevent unbounded log growth.
- Set `ulimits` for api-server if Playwright needs it.

### [ ] 8. Structured logging

- Replace `console.log` in [packages/api-server/src/index.ts](../packages/api-server/src/index.ts) with a structured logger (pino is lightest, one-dep). Emit JSON.
- Add a log level env var (`LOG_LEVEL=info`).
- Include request IDs on API log lines for correlation.

### [ ] 9. Error monitoring

- Add Sentry (or OpenTelemetry → your backend of choice) to both the API server and web UI.
- Wire unhandled promise rejections + uncaught exceptions to the reporter.
- Scrub PII / API keys from breadcrumbs before send.

### [ ] 10. Health/readiness split

- `/api/health` currently doubles as liveness and readiness. Add `/api/ready` that verifies storage connectivity + crawl4ai reachability; keep `/api/health` as a cheap liveness probe.

### [ ] 11. Rate limiting — move off in-memory

- Current bucket is per-process memory ([packages/api-server/src/shared.ts:162-178](../packages/api-server/src/shared.ts#L162-L178)). For single-instance local prod that's okay; for any scale-out, back it with Redis.
- Document the single-instance constraint if staying with current impl.

### [ ] 12. CORS review

- Default `CORS_ORIGINS=localhost:5173,localhost:8080` — set explicitly to the production origin before deploying.
- When served via same-origin nginx, CORS becomes moot for the browser but still matters for any direct API consumers.

### [ ] 13. Auth defaults

- If `ATELIER_API_KEY` is unset, the API is open. For prod: make the server refuse to start without an auth mode configured, or default to a "deny all writes" posture.
- Audit routes in [packages/api-server/src/routes/](../packages/api-server/src/routes/) — confirm every mutation endpoint calls `authenticate()`.

### [ ] 14. Database durability

- SQLite on `canvas-data` volume is fine for single-node. Add:
  - Nightly `sqlite3 .backup` to a mount or cloud store.
  - Document restore procedure.
- If MongoDB is in the picture for analytics, containerize it with its own healthcheck + volume, or commit to managed (Atlas) and document the connection string.

---

## P2 — Observability & ops

### [ ] 15. Metrics endpoint

- Expose `/metrics` (Prometheus format) from api-server: request count, latency p50/p95/p99, SSE connection count, rate-limit hits, LLM call counts per stage.
- Add a `prometheus` + `grafana` service to compose under a `monitoring` profile.

### [ ] 16. LLM cost & quota visibility

- Log OpenRouter usage per request (tokens, model, cost). Surface a `/api/admin/usage` endpoint gated on admin role.
- Alert on daily spend threshold.

### [ ] 17. Background job hygiene

- Cleanup tasks and batch scripts should be idempotent and safe to interrupt. Audit `scripts/batch-enhance-skeletons.ts` — confirm partial runs don't leave orphans in `generated_components`.

---

## P3 — CI/CD

### [ ] 18. Build & push images in CI

- Extend `.github/workflows/ci.yml` to build `api-server` and `web-ui` images on `main` pushes.
- Push to GHCR (`ghcr.io/<org>/atelier-api-server:<sha>`) with `latest` tag on main.
- Tag releases separately (`v1.2.3`).

### [ ] 19. Deploy workflow

- Add a `deploy.yml` that pulls the latest image on the target host and runs `docker compose pull && docker compose up -d`.
- Or: ship a single-command deploy script documented in README.

### [ ] 20. E2E smoke test in CI

- Boot the full stack via compose in CI, hit `/api/health`, load the web UI, run one generation.
- Playwright against the dockerized stack gives highest signal.

---

## Ansible + Vault deployment readiness

Target deploy is a Docker host provisioned by Ansible with secrets in Ansible Vault. The current setup is mostly compatible — listing the gaps and gotchas:

### What already works
- API server loads secrets from `.env` at **runtime** via `env_file: .env` in [docker-compose.yml](../docker-compose.yml#L30) — Ansible can `template:` `.env` from vault vars and `docker compose up -d` picks them up on restart.
- All secret-class vars are documented in [.env.example](../.env.example) — gives Ansible a 1:1 schema for `vars/secrets.yml`.
- Compose project name (`atelier`) and image names are stable — Ansible's `community.docker.docker_compose_v2` module can manage the stack by name.

### Gotchas Ansible playbook must handle

#### [ ] Build-time vs runtime env split
- **Web-UI bakes `VITE_*` vars at build time** ([packages/web-ui/Dockerfile:24](../packages/web-ui/Dockerfile#L24) → `COPY .env*` → `vite build`). The playbook MUST `template` `.env` BEFORE `docker compose build`, not after.
- API server reads `.env` at runtime via `env_file:`, so it tolerates `.env` changes without rebuild.
- Practical sequence in playbook: `template .env` → `docker compose build` → `docker compose up -d`.

#### [ ] Vault → .env templating
- Use `template` module with `mode: '0600'` for `.env` on the host.
- Don't leave the rendered `.env` readable by other users on the host.
- Don't commit any rendered `.env` to git (already in [.gitignore](../.gitignore)).

#### [ ] Image registry vs build-on-target
- Two viable patterns:
  - **Build on target**: simpler, no registry needed; playbook runs `docker compose build` after templating `.env`. Slower per deploy.
  - **Build in CI, push to GHCR, pull on target**: faster deploys, but `VITE_*` vars are baked at CI build time → CI also needs vault access OR a separate "production build" step in the playbook before push.
- Recommendation: start with build-on-target, move to registry once deploy frequency justifies it.

#### [ ] Volume persistence across redeploys
- `atelier_atelier-data` is marked `external: true` in [docker-compose.yml](../docker-compose.yml#L77-L80), so `docker compose down` does NOT remove it. Ansible can `docker compose down && up` safely.
- Playbook should `docker volume create atelier_atelier-data` once before first deploy.

#### [ ] No build args for secrets
- Resist any future change that uses `--build-arg SECRET=...` — Ansible would have to shuttle these separately. Keep secrets flowing through `.env` only.

#### [ ] Crawl4ai image pin
- `unclecode/crawl4ai:0.7.4` is fixed → reproducible across hosts. Pin to digest (`@sha256:...`) for paranoid reproducibility.

#### [ ] CORS_ORIGINS / redirect URIs
- `CORS_ORIGINS` ([packages/api-server/src/shared.ts](../packages/api-server/src/shared.ts)) defaults to localhost — Ansible must template it to the production hostname before deploy.
- Azure app registration MUST have the production redirect URI added (e.g., `https://atelier.example.com`); not something Ansible can do — must be a one-time manual Azure step.

### Suggested playbook structure (rough)
```
- hosts: docker_servers
  tasks:
    - template: src=env.j2 dest=/opt/atelier/.env mode=0600
    - copy: src=docker-compose.yml dest=/opt/atelier/
    - community.docker.docker_compose_v2:
        project_src: /opt/atelier
        build: always
        state: present
```

---

## P4 — Nice to have

- [ ] HTTPS: add Caddy or a Traefik sidecar for automatic Let's Encrypt if deploying to a public host.
- [ ] SBOM generation (`syft`) in CI for supply-chain visibility.
- [ ] `docker scan` / Trivy in CI for image CVE checks.
- [ ] A `Makefile` or `justfile` with `make up`, `make down`, `make logs`, `make shell` targets to reduce ceremony.
- [ ] Admin UI route gating — confirm `#/review` and other admin paths enforce role checks client-side AND server-side.
- [ ] Component/skeleton asset CDN — if the skeleton library grows, serve cinematic images from a CDN rather than bundling.

---

## File touchpoints

| Concern | File |
|---|---|
| Compose merge | [docker-compose.yml](../docker-compose.yml), [docker-compose.prod.yml](../docker-compose.prod.yml) |
| API Docker build | [packages/api-server/Dockerfile](../packages/api-server/Dockerfile) |
| Web-UI Docker build | [packages/web-ui/Dockerfile](../packages/web-ui/Dockerfile) |
| nginx config | [packages/web-ui/nginx.conf](../packages/web-ui/nginx.conf) |
| Vite config / dev proxy | [packages/web-ui/vite.config.ts](../packages/web-ui/vite.config.ts) |
| API bootstrap / env loading | [packages/api-server/src/index.ts](../packages/api-server/src/index.ts) |
| Auth, CORS, rate limit | [packages/api-server/src/shared.ts](../packages/api-server/src/shared.ts) |
| CI | [.github/workflows/ci.yml](../.github/workflows/ci.yml) |
| Secrets template | [.env.example](../.env.example) |

---

## First concrete milestone

Ship P0 items 1, 3, 4 together — that gets you to "one compose up, no committed secrets, reproducible build" which is the minimum bar for calling the setup production-testable. Everything beyond P0 is hardening that can ship incrementally.
