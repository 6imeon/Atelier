import { route, authenticate, body, json, sdk, storage, getRequestUser, PORT } from "../shared";

export function registerProjectRoutes() {
  // Create project — sets owner from auth context
  route("POST", "/api/projects", async (req, res) => {
    await authenticate(req);
    const user = getRequestUser(req);
    const b = await body(req);
    const title = typeof b.title === "string" ? b.title.slice(0, 255) : "Untitled";
    const p = sdk.createProject(title);
    const now = new Date().toISOString();
    if (storage) {
      await storage.createProject({
        id: p.id, title, screens: [],
        ownerId: user?.userId ?? null,
        lastAccessedAt: now,
        createdAt: now, updatedAt: now,
      });
    }
    json(res, { id: p.id, title }, 201);
  });

  // List projects — filtered by owner, paginated, excludes expired by default
  route("GET", "/api/projects", async (req, res) => {
    if (!storage) { json(res, { projects: [], nextCursor: null }); return; }
    const user = getRequestUser(req);
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const includeExpired = url.searchParams.get("includeExpired") === "true";

    const result = await storage.listProjects({
      ownerId: user?.userId !== "apikey-user" ? user?.userId : undefined,
      limit,
      cursor,
      includeExpired,
    });

    json(res, {
      projects: result.projects.map(p => ({
        id: p.id, title: p.title, ownerId: p.ownerId,
        lastAccessedAt: p.lastAccessedAt,
        createdAt: p.createdAt, updatedAt: p.updatedAt,
      })),
      nextCursor: result.nextCursor ?? null,
    });
  });

  // Get single project — verifies ownership
  route("GET", "/api/projects/:pid", async (req, res, params) => {
    if (!storage) { json(res, { error: "Storage not configured" }, 503); return; }
    const p = await storage.getProject(params.pid);
    if (!p) { json(res, { error: "Project not found" }, 404); return; }

    // Ownership check
    const user = getRequestUser(req);
    if (p.ownerId && user && user.userId !== "apikey-user" && p.ownerId !== user.userId) {
      json(res, { error: "Forbidden" }, 403); return;
    }

    // Touch on access
    await storage.touchProject(params.pid);

    const screens = await storage.listScreens(params.pid);
    json(res, {
      id: p.id, title: p.title, ownerId: p.ownerId,
      lastAccessedAt: p.lastAccessedAt,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
      screens: screens.map(s => ({ id: s.id, prompt: s.prompt, deviceType: s.deviceType })),
    });
  });

  // Delete project — owner only
  route("DELETE", "/api/projects/:pid", async (req, res, params) => {
    await authenticate(req);
    if (!storage) { json(res, { error: "Storage not configured" }, 503); return; }
    const p = await storage.getProject(params.pid);
    if (!p) { json(res, { error: "Project not found" }, 404); return; }

    const user = getRequestUser(req);
    if (p.ownerId && user && user.userId !== "apikey-user" && p.ownerId !== user.userId) {
      json(res, { error: "Forbidden" }, 403); return;
    }

    await storage.deleteProject(params.pid);
    json(res, { ok: true });
  });

  // Touch project — reset 30-day expiry timer
  route("POST", "/api/projects/:pid/touch", async (req, res, params) => {
    await authenticate(req);
    if (!storage) { json(res, { error: "Storage not configured" }, 503); return; }
    const p = await storage.getProject(params.pid);
    if (!p) { json(res, { error: "Project not found" }, 404); return; }

    const user = getRequestUser(req);
    if (p.ownerId && user && user.userId !== "apikey-user" && p.ownerId !== user.userId) {
      json(res, { error: "Forbidden" }, 403); return;
    }

    await storage.touchProject(params.pid);
    json(res, { ok: true });
  });

  // Get current user profile
  route("GET", "/api/me", async (req, res) => {
    await authenticate(req);
    const user = getRequestUser(req);
    if (!user) { json(res, { error: "Not authenticated" }, 401); return; }

    // For API key mode, return a static profile
    if (user.userId === "apikey-user") {
      json(res, {
        id: "apikey-user",
        email: null,
        displayName: "API Key User",
        avatarUrl: null,
        roles: user.roles,
        authMode: "apikey",
      });
      return;
    }

    // For Entra mode, look up the full user record
    if (storage) {
      const dbUser = await storage.getUser(user.userId);
      if (dbUser) {
        json(res, {
          id: dbUser.id,
          email: dbUser.email,
          displayName: dbUser.displayName,
          avatarUrl: dbUser.avatarUrl,
          createdAt: dbUser.createdAt,
          lastLogin: dbUser.lastLogin,
          roles: user.roles,
          authMode: "entra",
        });
        return;
      }
    }

    json(res, { id: user.userId, email: user.email, displayName: user.displayName, roles: user.roles, authMode: "entra" });
  });
}
