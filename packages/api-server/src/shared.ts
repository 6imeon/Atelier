import { IncomingMessage, ServerResponse } from "http";
import { CanvasAI, ComponentLibrary } from "@canvas-ai/sdk";
import type { AnalyticsAdapter, StorageAdapter } from "@canvas-ai/sdk";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

// --- Shared state (initialized in index.ts) ---
export const sdk = new CanvasAI();
export const componentLibrary = new ComponentLibrary();
export let storage: StorageAdapter | null = null;
export let analytics: AnalyticsAdapter | null = null;

export function setStorage(s: StorageAdapter) { storage = s; }
export function setAnalytics(a: AnalyticsAdapter) { analytics = a; }

// --- Config ---
export const PORT = parseInt(process.env.PORT ?? "8080", 10);
export const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:8080").split(",");
const API_KEY = process.env.ATELIER_API_KEY || "";
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

export const VALID_DEVICE_TYPES = ["MOBILE", "DESKTOP", "TABLET", "AGNOSTIC"] as const;

// --- Auth ---
export class AuthError extends Error { constructor(msg: string) { super(msg); this.name = "AuthError"; } }

// Master gate for Microsoft 365 / Entra ID sign-in. When "false", Entra is
// disabled regardless of AUTH_MODE and the server falls back to API-key auth.
const ENTRA_ENABLED = (process.env.ENTRA_ENABLED ?? "true") !== "false";
const RAW_AUTH_MODE = (process.env.AUTH_MODE ?? "apikey") as "apikey" | "entra" | "both";
const AUTH_MODE = ENTRA_ENABLED ? RAW_AUTH_MODE : "apikey";
// Single app registration — one client ID used as both SPA client and API audience
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || "";
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || "";

// App Roles defined in the Entra app manifest
export type AppRole = "Admin" | "Designer" | "Viewer";
const VALID_ROLES: AppRole[] = ["Admin", "Designer", "Viewer"];

// Entra JWKS — lazily initialized, cached by jose internally
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJWKS() {
  if (!_jwks && AZURE_TENANT_ID) {
    _jwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/discovery/v2.0/keys`)
    );
  }
  return _jwks;
}

// User context attached per-request
interface RequestUser {
  userId: string;
  email?: string;
  displayName?: string;
  roles: AppRole[];
}
const requestUserMap = new WeakMap<IncomingMessage, RequestUser>();

export function getRequestUser(req: IncomingMessage): RequestUser | null {
  return requestUserMap.get(req) ?? null;
}

/** Check if the current user has a specific role. API-key users have Admin by default. */
export function requireRole(req: IncomingMessage, ...allowed: AppRole[]) {
  const user = getRequestUser(req);
  if (!user) throw new AuthError("Not authenticated");
  if (user.roles.some(r => allowed.includes(r))) return;
  throw new AuthError("Insufficient permissions");
}

export async function authenticate(req: IncomingMessage) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  // API key mode (default, dev-friendly — no key = open access)
  if (AUTH_MODE === "apikey" || AUTH_MODE === "both") {
    if (!API_KEY) {
      // No key configured = open dev mode, use shared identity (Admin by default)
      requestUserMap.set(req, { userId: "apikey-user", displayName: "API Key User", roles: ["Admin"] });
      return;
    }
    if (token === API_KEY) {
      requestUserMap.set(req, { userId: "apikey-user", displayName: "API Key User", roles: ["Admin"] });
      return;
    }
    if (AUTH_MODE === "apikey") {
      throw new AuthError("Invalid or missing API key");
    }
  }

  // Entra ID mode — verify JWT from Microsoft (single app registration)
  if ((AUTH_MODE === "entra" || AUTH_MODE === "both") && token) {
    const jwks = getJWKS();
    if (jwks && AZURE_TENANT_ID && AZURE_CLIENT_ID) {
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: `https://login.microsoftonline.com/${AZURE_TENANT_ID}/v2.0`,
          // Accept both client ID (ID tokens) and api:// URI (access tokens)
          audience: [AZURE_CLIENT_ID, `api://${AZURE_CLIENT_ID}`],
        });

        const oid = (payload as JWTPayload & { oid?: string }).oid ?? payload.sub ?? "";
        const email = (payload as any).email ?? (payload as any).preferred_username ?? "";
        const name = (payload as any).name ?? email;

        // Extract App Roles from token (defined in Entra app manifest)
        const tokenRoles = (payload as any).roles as string[] | undefined;
        const roles: AppRole[] = tokenRoles
          ? tokenRoles.filter((r): r is AppRole => VALID_ROLES.includes(r as AppRole))
          : ["Viewer"]; // Default role if none assigned

        // Upsert user in storage if available
        if (storage && oid) {
          const existing = await storage.getUserByEntraOid(oid);
          const userId = existing?.id ?? `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await storage.upsertUser({
            id: userId, entraOid: oid, email, displayName: name,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
            lastLogin: new Date().toISOString(),
          });
          requestUserMap.set(req, { userId, email, displayName: name, roles });
        } else {
          requestUserMap.set(req, { userId: oid || "entra-user", email, displayName: name, roles });
        }
        return;
      } catch (err: any) {
        if (AUTH_MODE === "entra") {
          throw new AuthError(`Invalid token: ${err.message}`);
        }
      }
    }
  }

  throw new AuthError("Invalid or missing credentials");
}

// --- SSRF Protection ---
const PRIVATE_IP_PATTERNS = [
  /^https?:\/\/localhost[:/]/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/0\./,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/\[fc/i,
  /^https?:\/\/\[fd/i,
  /^https?:\/\/\[fe80:/i,
];

export function validateExternalUrl(url: string) {
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(url)) throw new Error("URLs pointing to private/internal networks are not allowed");
  }
}

// --- Validation ---
export function validateRequired(obj: Record<string, unknown>, fields: string[]) {
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null || obj[f] === "") throw new Error(`Missing required field: ${f}`);
  }
}

// --- Rate Limiting ---
const rateBuckets = new Map<string, number[]>();
export function rateLimit(req: IncomingMessage, limit = 30) {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const bucket = (rateBuckets.get(ip) ?? []).filter(t => now - t < 60_000);
  if (bucket.length >= limit) throw new Error("Rate limit exceeded. Try again later.");
  bucket.push(now);
  rateBuckets.set(ip, bucket);
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    const active = bucket.filter(t => now - t < 60_000);
    if (active.length === 0) rateBuckets.delete(ip);
    else rateBuckets.set(ip, active);
  }
}, 60_000).unref();

// --- Body Parser ---
export async function body(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let d = "";
    req.on("data", (c: string | Buffer) => {
      size += typeof c === "string" ? Buffer.byteLength(c) : c.length;
      if (size > MAX_BODY_BYTES) { req.destroy(); reject(new Error("Payload too large (max 10 MB)")); return; }
      d += c;
    });
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch { reject(new Error("Bad JSON")); } });
  });
}

// --- JSON Response ---
export function json(res: ServerResponse, data: unknown, status = 200, origin?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin && ALLOWED_ORIGINS.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

// --- Router ---
export type Handler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => Promise<void>;
interface Route { method: string; pattern: RegExp; paramNames: string[]; handler: Handler; }
const routes: Route[] = [];

export function route(method: string, path: string, handler: Handler) {
  const paramNames: string[] = [];
  const re = path.replace(/:(\w+)/g, (_, n) => { paramNames.push(n); return "([^/]+)"; });
  routes.push({ method, pattern: new RegExp(`^${re}$`), paramNames, handler });
}

export function match(method: string, path: string) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.pattern);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.paramNames.forEach((n, i) => params[n] = m[i + 1]);
    return { handler: r.handler, params };
  }
  return null;
}

// --- SSE Helper ---
export function setupSSE(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin ?? "";
  const headers: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  };
  if (ALLOWED_ORIGINS.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  res.writeHead(200, headers);

  const sendEvent = (type: string, data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  return sendEvent;
}
