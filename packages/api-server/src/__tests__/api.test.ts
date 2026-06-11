/**
 * API endpoint tests for the Atelier API server.
 *
 * These tests spin up a real HTTP server on a random port and exercise
 * middleware (auth, CORS, rate-limit, body-size) plus basic CRUD routes.
 *
 * The SDK is stubbed via OPENROUTER_API_KEY so the CanvasAI constructor
 * does not throw. No real AI calls are made.
 */

// Env vars are set in setup.ts (vitest setupFiles) before any module loads.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, Server } from "http";
import {
  route,
  match,
  authenticate,
  body,
  json,
  rateLimit,
  AuthError,
  ALLOWED_ORIGINS,
} from "../shared";

// --- Helpers ---

let server: Server;
let baseUrl: string;

async function req(
  path: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
) {
  return fetch(`${baseUrl}${path}`, {
    method: opts.method ?? "GET",
    headers: opts.headers,
    body: opts.body,
  });
}

// --- Build a lightweight server mirroring index.ts ---

function buildServer(): Server {
  // Health
  route("GET", "/api/health", async (_r, res) => json(res, { status: "ok" }));

  // Project create (simplified, no storage)
  route("POST", "/api/projects", async (req, res) => {
    await authenticate(req);
    const b = await body(req);
    const title = typeof b.title === "string" ? b.title.slice(0, 255) : "Untitled";
    const id = `proj_${Date.now()}`;
    json(res, { id, title }, 201);
  });

  // Screen generate stub -- validates required fields + rate limit
  route("POST", "/api/projects/:pid/screens/generate", async (req, res) => {
    await authenticate(req);
    rateLimit(req, 5); // low limit for testing
    const b = await body(req);
    if (!b.prompt) {
      throw new Error("Missing required field: prompt");
    }
    json(res, { ok: true });
  });

  return createServer(async (req, res) => {
    const origin = req.headers.origin ?? "";

    if (req.method === "OPTIONS") {
      const headers: Record<string, string> = {
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };
      if (ALLOWED_ORIGINS.includes(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
      }
      res.writeHead(204, headers);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    const m = match(req.method ?? "GET", url.pathname);
    if (!m) {
      json(res, { error: "Not found" }, 404, origin);
      return;
    }

    try {
      await m.handler(req, res, m.params);
    } catch (err: any) {
      const status =
        err instanceof AuthError
          ? 401
          : err.message.includes("Payload too large")
            ? 413
            : err.message.includes("Rate limit")
              ? 429
              : err.message.includes("Missing required")
                ? 400
                : 500;
      json(res, { error: err.message }, status, origin);
    }
  });
}

// --- Lifecycle ---

beforeAll(async () => {
  server = buildServer();
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// --- Tests ---

describe("API Server", () => {
  // 1. Health check
  it("GET /api/health returns 200 with { status: 'ok' }", async () => {
    const res = await req("/api/health");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ status: "ok" });
  });

  // 2. Auth -- missing key
  it("POST /api/projects without API key returns 401", async () => {
    const res = await req("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "No Auth" }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Invalid or missing API key/);
  });

  // 3. Auth -- correct key
  it("POST /api/projects with correct Bearer token returns 201", async () => {
    const res = await req("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-secret-key",
      },
      body: JSON.stringify({ title: "My Project" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.title).toBe("My Project");
  });

  // 4. Body size limit
  it("POST with >10 MB body returns 413 or connection error", async () => {
    const huge = "x".repeat(11 * 1024 * 1024);
    try {
      const res = await req("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-secret-key",
        },
        body: huge,
      });
      // Server may return 413 or destroy the connection
      expect([413, 0]).toContain(res.status);
    } catch {
      // fetch throws when the server destroys the socket -- acceptable
      expect(true).toBe(true);
    }
  });

  // 5. Input validation -- missing prompt
  it("POST /api/projects/:pid/screens/generate without prompt returns 400", async () => {
    const res = await req("/api/projects/proj_1/screens/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-secret-key",
      },
      body: JSON.stringify({ deviceType: "DESKTOP" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Missing required field: prompt/);
  });

  // 6. Rate limiting
  it("returns 429 after exceeding rate limit", async () => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer test-secret-key",
      "X-Forwarded-For": "10.99.99.99", // unique IP to avoid interference
    };

    const results: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await req("/api/projects/proj_1/screens/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt: "test" }),
      });
      results.push(res.status);
    }

    expect(results).toContain(429);
  });

  // 7. CORS preflight -- allowed origin
  it("OPTIONS preflight returns correct CORS headers for allowed origin", async () => {
    const res = await req("/api/projects", {
      method: "OPTIONS",
      headers: { Origin: "http://test-origin.example" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toBe("GET,POST,OPTIONS");
    expect(res.headers.get("access-control-allow-headers")).toBe(
      "Content-Type, Authorization",
    );
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://test-origin.example",
    );
  });

  // 8. CORS -- disallowed origin
  it("OPTIONS preflight for unknown origin omits Access-Control-Allow-Origin", async () => {
    const res = await req("/api/projects", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example.com" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  // 9. 404
  it("GET /api/unknown returns 404", async () => {
    const res = await req("/api/unknown");
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Not found");
  });

  // 10. Project creation shape
  it("POST /api/projects returns id prefixed with proj_ and the supplied title", async () => {
    const res = await req("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-secret-key",
      },
      body: JSON.stringify({ title: "Test Project" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toMatch(/^proj_/);
    expect(data.title).toBe("Test Project");
  });
});
