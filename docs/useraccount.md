# User Accounts & Project Library — Implementation Plan

## 1. Overview

Add multi-user support to Atelier with:
- **User accounts** authenticated via Microsoft Entra ID (Azure AD)
- **Per-user project libraries** with browsing, filtering, and pagination
- **Auto-cleanup** of projects inactive for 30+ days
- **Graceful fallback** to API-key auth until Entra is configured

---

## 2. Architecture

```
┌─────────────────┐        ┌──────────────────┐
│   React SPA     │        │   API Server     │
│                 │        │                  │
│  @azure/msal-   │  JWT   │  jose (verify)   │
│  react + browser├───────►│  + middleware     │
│                 │ Bearer │                  │
│  Login/Logout   │        │  user context    │
│  Token cache    │        │  per request     │
└─────────────────┘        └────────┬─────────┘
                                    │
                           ┌────────▼─────────┐
                           │     SQLite        │
                           │                   │
                           │  users            │
                           │  projects (+ FK)  │
                           │  screens  (+ FK)  │
                           └───────────────────┘
```

### Auth Flow (Authorization Code + PKCE)

1. SPA calls `msalInstance.loginRedirect()` — redirects to Entra `/authorize`
2. User authenticates, Entra returns auth code to SPA redirect URI
3. `msal-browser` exchanges code for **access token** (no client secret in browser)
4. SPA sends `Authorization: Bearer <access_token>` on every API call
5. API server validates JWT signature via Entra's JWKS endpoint using `jose`
6. API extracts `oid` (Entra object ID) + `email` + `name` from token claims
7. API upserts user record in SQLite, attaches `userId` to request context

---

## 3. Entra ID Setup (Azure Portal)

### 3.1 Register Two Apps

| App | Platform | Purpose |
|-----|----------|---------|
| **Atelier SPA** | Single-page application | Frontend login, token acquisition |
| **Atelier API** | Web API | Token validation, scope definition |

### 3.2 SPA Registration
1. Azure Portal > App registrations > New registration
2. Name: `Atelier - SPA`
3. Supported account types: **Single tenant** (or multi-tenant if needed)
4. Redirect URI: `http://localhost:5173` (dev), `https://app.yourdomain.com` (prod)
5. Platform: **Single-page application** (enables PKCE, no implicit flow needed)
6. No client secret needed

### 3.3 API Registration
1. New registration > Name: `Atelier - API`
2. Under **Expose an API** > Set Application ID URI (e.g., `api://<api-client-id>`)
3. Add scope: `api://<api-client-id>/access` (display: "Access Atelier")
4. Under the SPA registration > **API permissions** > Add permission > My APIs > Select the API scope

### 3.4 Environment Variables

```env
# API Server
AZURE_TENANT_ID=your-tenant-id
AZURE_API_CLIENT_ID=your-api-client-id

# SPA (VITE_ prefix for Vite)
VITE_AZURE_SPA_CLIENT_ID=your-spa-client-id
VITE_AZURE_TENANT_ID=your-tenant-id
VITE_AZURE_API_SCOPE=api://your-api-client-id/access

# Auth mode: "entra" | "apikey" | "both" (default: "apikey")
AUTH_MODE=apikey
```

---

## 4. Database Schema Changes

### 4.1 New `users` Table

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,           -- UUID v4 (internal)
  entra_oid   TEXT UNIQUE,                -- Entra Object ID (from JWT "oid" claim)
  email       TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url  TEXT,                       -- Optional, from Entra profile
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_login  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_users_entra_oid ON users(entra_oid);
CREATE INDEX idx_users_email ON users(email);
```

### 4.2 Modify `projects` Table

```sql
-- Add owner column (nullable for backwards compatibility during migration)
ALTER TABLE projects ADD COLUMN owner_id TEXT REFERENCES users(id);
ALTER TABLE projects ADD COLUMN last_accessed_at TEXT DEFAULT (datetime('now'));

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_last_accessed ON projects(last_accessed_at);
```

### 4.3 Migration Strategy

- Run `ALTER TABLE` on first boot when `users` table doesn't exist
- Existing projects get `owner_id = NULL` (accessible by any authenticated user)
- New projects always set `owner_id` from request context
- Add migration version tracking: simple `schema_version` pragma or a `migrations` table

---

## 5. API Server Changes

### 5.1 Auth Middleware (Dual-Mode)

```
authenticate(req) →
  1. Check AUTH_MODE env var
  2. If "entra" or "both":
     - Extract Bearer token from Authorization header
     - Verify JWT via jose + Entra JWKS (cached)
     - Extract: oid, email, name from claims
     - Upsert user in SQLite
     - Attach userId to request context
  3. If "apikey" or "both":
     - Fall back to existing ATELIER_API_KEY check
     - userId = "apikey-user" (shared identity)
  4. If neither succeeds: throw AuthError
```

### 5.2 Libraries

| Package | Purpose | Size |
|---------|---------|------|
| `jose` | JWT verification + JWKS fetching | ~50KB, zero deps |
| `uuid` | Generate user IDs | ~5KB (or use `crypto.randomUUID()`) |

**Why `jose` over `jsonwebtoken`?** Zero dependencies, ESM-native, built-in JWKS support via `createRemoteJWKSet()`. Token validation is ~10 lines:

```typescript
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`)
);

const { payload } = await jwtVerify(token, JWKS, {
  issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
  audience: API_CLIENT_ID,
});
// payload.oid, payload.email, payload.name
```

### 5.3 New/Modified Endpoints

| Method | Endpoint | Change |
|--------|----------|--------|
| GET | `/api/me` | **New** — return current user profile |
| GET | `/api/projects` | Filter by `owner_id` from auth context |
| POST | `/api/projects` | Set `owner_id` from auth context |
| GET | `/api/projects/:pid` | Verify ownership (or admin role) |
| DELETE | `/api/projects/:pid` | **New** — soft delete, owner only |
| POST | `/api/projects/:pid/touch` | **New** — update `last_accessed_at` |

### 5.4 Ownership Enforcement

```
Every project route:
  1. Get userId from request context
  2. Load project from storage
  3. If project.owner_id exists AND != userId → 403 Forbidden
  4. If project.owner_id is NULL → allow (legacy project)
```

---

## 6. Frontend Changes

### 6.1 Dependencies

```json
{
  "@azure/msal-browser": "^3.x",
  "@azure/msal-react": "^2.x"
}
```

### 6.2 MSAL Configuration

```typescript
// src/auth/msalConfig.ts
export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_SPA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",  // safer than localStorage
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: [import.meta.env.VITE_AZURE_API_SCOPE],
};
```

### 6.3 App Wrapper

```tsx
// Wrap <App /> with MsalProvider
<MsalProvider instance={msalInstance}>
  <App />
</MsalProvider>
```

### 6.4 Token Acquisition for API Calls

Update `utils/api.ts`:

```typescript
import { msalInstance, loginRequest } from "../auth/msalConfig";

export async function apiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (import.meta.env.VITE_AZURE_SPA_CLIENT_ID) {
    // Entra mode: get token silently (refreshes if needed)
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      headers["Authorization"] = `Bearer ${response.accessToken}`;
    }
  } else if (import.meta.env.VITE_ATELIER_API_KEY) {
    // Fallback: API key mode
    headers["Authorization"] = `Bearer ${import.meta.env.VITE_ATELIER_API_KEY}`;
  }

  return headers;
}
```

### 6.5 New UI Components

| Component | Purpose |
|-----------|---------|
| `LoginButton.tsx` | Entra login/logout, shows avatar + name |
| `ProjectLibrary.tsx` | Grid/list view of user's projects with search, sort, pagination |
| `ProjectCard.tsx` | Card showing project title, last accessed, screen count, thumbnail |
| `AccountSettings.tsx` | Display user info (read-only from Entra), possibly preferences |

### 6.6 Project Library UX

```
┌─────────────────────────────────────────────────┐
│  My Projects                    [+ New Project]  │
│                                                  │
│  Search: [________________]  Sort: [Last used ▼] │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ thumb    │  │ thumb    │  │ thumb    │       │
│  │          │  │          │  │          │       │
│  │ Project A│  │ Project B│  │ Project C│       │
│  │ 3 screens│  │ 1 screen │  │ 5 screens│       │
│  │ 2d ago   │  │ 15d ago  │  │ 28d ago ⚠│       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                  │
│  ◄ 1 2 3 ►                                      │
└─────────────────────────────────────────────────┘
```

- Projects nearing 30-day expiry show a warning badge
- Clicking a project opens it in the canvas editor
- "New Project" opens a title dialog, then navigates to canvas

---

## 7. Auto-Cleanup (30-Day TTL)

### 7.1 Strategy: Hybrid (Lazy + Scheduled)

**Why hybrid?** Lazy cleanup alone leaves orphaned data if users never return. Scheduled-only adds complexity. Combining both is robust with minimal overhead.

### 7.2 `last_accessed_at` Tracking

Update `last_accessed_at` on:
- Project load (GET `/api/projects/:pid`)
- Screen generation/edit
- Explicit "touch" from UI when project is open

### 7.3 Lazy Cleanup (on access)

When listing projects, exclude stale ones:
```sql
SELECT * FROM projects
WHERE owner_id = ?
  AND (last_accessed_at > datetime('now', '-30 days') OR last_accessed_at IS NULL)
ORDER BY last_accessed_at DESC
```

### 7.4 Scheduled Cleanup (daily)

```typescript
// In api-server startup
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

setInterval(async () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Soft delete: mark projects past TTL
  //    (or hard delete if soft-delete isn't needed)
  const stale = storage.query(
    `SELECT id FROM projects WHERE last_accessed_at < ? AND last_accessed_at IS NOT NULL`,
    [cutoff]
  );

  for (const { id } of stale) {
    await storage.deleteProject(id);  // cascades to screens via FK
    console.log(`[cleanup] Deleted stale project ${id}`);
  }

  console.log(`[cleanup] Removed ${stale.length} stale projects`);
}, CLEANUP_INTERVAL);
```

### 7.5 User Notification (Frontend)

- Show warning badge on projects with < 5 days until expiry
- Tooltip: "This project will be auto-removed on [date]. Open it to reset the timer."
- Opening/editing a project resets the 30-day clock automatically

---

## 8. Implementation Order

### Phase 1: Database + API Foundation (no Entra yet) — DONE
1. ~~Add `users` table and `owner_id`/`last_accessed_at` to projects~~ DONE
2. ~~Create `GET /api/me` endpoint (returns static user for API-key mode)~~ DONE
3. ~~Update project routes to filter by owner + track `last_accessed_at`~~ DONE
4. ~~Add `DELETE /api/projects/:pid` endpoint~~ DONE
5. ~~Implement auto-cleanup `setInterval`~~ DONE (24h interval, 30-day cutoff)
6. ~~Add `listProjects` pagination (cursor-based)~~ DONE
   - Also added: `POST /api/projects/:pid/touch`, ownership enforcement on all project routes
   - Also added: auto-migration for existing DBs (ALTER TABLE if columns missing)
   - Also added: `AUTH_MODE` env var support, `DELETE` CORS method

### Phase 2: Frontend Project Library — DONE
7. ~~Create `ProjectLibrary.tsx` with kanban board view, search, expiry badges~~ DONE
8. ~~Create `NewProjectModal.tsx` with command palette style~~ DONE
9. ~~Add routing: `#/` = project library, `#/project/:id` = canvas editor~~ DONE (hash-based, no deps)
10. ~~Wire up project creation flow (command palette > navigate to canvas)~~ DONE
11. ~~Add delete confirmation dialog~~ DONE
   - Also added: `fetchProjects`, `deleteProject`, `touchProject`, `fetchMe` API helpers in utils/api.ts
   - Also added: Back-to-projects button in TopBar (logo + chevron)
   - Also added: Periodic touchProject (5min interval) while in editor to reset expiry
   - Also added: User profile display in library top bar

### Phase 3: Entra ID Integration — DONE
12. ~~Install `jose` on API server, `@azure/msal-react` + `@azure/msal-browser` on web-ui~~ DONE
13. ~~Create MSAL config and `MsalProvider` wrapper~~ DONE (src/auth/msalConfig.ts)
14. ~~Implement dual-mode `authenticate()` middleware (`AUTH_MODE` env var)~~ DONE (jose JWT verification + user upsert)
15. ~~Create `LoginPage.tsx` with ultra minimal design (Dusty Rose)~~ DONE
16. ~~Update `apiHeaders()` to use MSAL token when available~~ DONE (apiHeadersAsync + sessionStorage fallback)
17. ~~Auth guard in App.tsx — MSAL redirect handling, login page routing~~ DONE
   - Also added: `authenticate()` is now async, all 15 call sites updated to `await`
   - Also added: LoginPage supports both Entra SSO button and API key input
   - Also added: sessionStorage-based API key persistence from login form
   - Also added: MsalProvider conditionally wraps app only when Entra is configured

### Phase 4: Polish — DONE
18. ~~Add role-based access via Entra App Roles (Admin, Designer, Viewer)~~ DONE (App Roles defined in Entra manifest, extracted from JWT claims in authenticate())
19. ~~Add `AccountPage.tsx` (profile, role, member since, usage stats, sign out, danger zone)~~ DONE (Dusty Rose palette, full-width sections)
20. Add project sharing (future — would need `project_members` junction table)

---

## 9. Estimated Scope

| Phase | Effort | Files Changed/Created |
|-------|--------|----------------------|
| Phase 1 | ~3-4h | sqlite.ts, interface.ts, shared.ts, projects.ts, index.ts |
| Phase 2 | ~4-5h | ProjectLibrary.tsx, ProjectCard.tsx, App.tsx, routing, api.ts |
| Phase 3 | ~3-4h | msalConfig.ts, LoginButton.tsx, shared.ts (auth), api.ts |
| Phase 4 | ~2-3h | AccountSettings.tsx, role checks |

---

## 10. Security Considerations

- **Never store tokens server-side** — SPA holds tokens in sessionStorage (msal default)
- **Always validate JWT signature** — never just decode; use `jwtVerify` with JWKS
- **Check `aud` claim** — must match your API's client ID to prevent token misuse
- **Check `iss` claim** — must match your Entra tenant
- **Enforce ownership** — every project route checks `owner_id` matches authenticated user
- **Rate limit unauthenticated requests** — existing rate limiter already covers this
- **CORS** — already configured, no changes needed
- **API key hashing** — when in API-key mode, compare with `crypto.timingSafeEqual` (upgrade from current `===`)

---

## 11. Open Questions

1. **Single tenant vs multi-tenant?** — Single tenant is simpler; multi-tenant allows external collaborators
2. **Soft delete vs hard delete?** — Hard delete saves storage; soft delete allows recovery (recommend hard delete for 30-day auto-cleanup since the warning period IS the grace period)
3. **Project sharing?** — Defer to Phase 4; would need `project_members` table with role (owner/editor/viewer)
4. **Storage quotas?** — Should each user have a max number of projects or total storage limit?
5. **Data export?** — Should users be able to export all their data (GDPR compliance)?
