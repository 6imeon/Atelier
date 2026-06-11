/**
 * Shared API configuration.
 * Supports Entra ID (MSAL) tokens and API key fallback.
 */
import { getMsalInstance, loginRequest, entraEnabled } from "../auth/msalConfig";

const ENV_API_KEY = import.meta.env.VITE_ATELIER_API_KEY || "";
function getApiKey(): string {
  return ENV_API_KEY || sessionStorage.getItem("atelier-api-key") || "";
}

export const API_BASE = "";

/**
 * Build API headers with auth. Uses MSAL token if Entra is configured,
 * otherwise falls back to API key. Synchronous callers can use apiHeaders()
 * for the API key path; use apiHeadersAsync() when Entra may be active.
 */
export function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
  const key = getApiKey();
  if (key) h["Authorization"] = `Bearer ${key}`;
  return h;
}

/** Get auth headers — uses MSAL ID token when Entra is configured, API key otherwise */
export async function getAuthHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json", ...extra };

  if (entraEnabled) {
    const msal = getMsalInstance();
    if (msal) {
      try {
        // Ensure MSAL is initialized before acquiring tokens
        await msal.initialize();
      } catch {
        // Already initialized — ignore
      }
      const accounts = msal.getAllAccounts();
      if (accounts.length > 0) {
        try {
          const response = await msal.acquireTokenSilent({
            ...loginRequest,
            account: accounts[0],
            forceRefresh: false,
          });
          // Use ID token for our API (access token is scoped to Graph)
          // acquireTokenSilent refreshes both tokens when they expire
          const token = response.idToken;
          if (token) {
            h["Authorization"] = `Bearer ${token}`;
            return h;
          }
        } catch {
          // Silent refresh failed — try interactive popup to get a fresh token
          try {
            const response = await msal.acquireTokenPopup({
              ...loginRequest,
              account: accounts[0],
            });
            // Use ID token for our API (access token is scoped to Graph)
          // acquireTokenSilent refreshes both tokens when they expire
          const token = response.idToken;
            if (token) {
              h["Authorization"] = `Bearer ${token}`;
              return h;
            }
          } catch {
            // Both silent and popup failed — user needs to re-login
            console.warn("[auth] Token expired and refresh failed — redirecting to login");
            sessionStorage.clear();
            window.location.hash = "";
            window.location.reload();
            return h;
          }
        }
      }
    }
  }

  // Fallback: API key
  const key = getApiKey();
  if (key) h["Authorization"] = `Bearer ${key}`;
  return h;
}

// ─── Project API ───

export interface ProjectSummary {
  id: string;
  title: string;
  ownerId?: string | null;
  lastAccessedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  screenCount?: number;
}

export async function fetchProjects(opts?: { limit?: number; cursor?: string; includeExpired?: boolean }): Promise<{ projects: ProjectSummary[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  if (opts?.includeExpired) params.set("includeExpired", "true");
  const res = await fetch(`${API_BASE}/api/projects?${params}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json();
}

export async function fetchProject(id: string): Promise<ProjectSummary & { screens: Array<{ id: string; prompt: string; deviceType: string }> }> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch project: ${res.status}`);
  return res.json();
}

export async function createProject(title: string): Promise<{ id: string; title: string }> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: "POST", headers: await getAuthHeaders(), body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Failed to create project: ${res.status}`);
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, {
    method: "DELETE", headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete project: ${res.status}`);
}

export async function touchProject(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/projects/${id}/touch`, {
    method: "POST", headers: await getAuthHeaders(),
  });
}

export async function fetchScreen(projectId: string, screenId: string): Promise<{ screenId: string; html: string; prompt: string; deviceType: string }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/screens/${screenId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch screen: ${res.status}`);
  return res.json();
}

export async function fetchMe(): Promise<{ id: string; email: string | null; displayName: string; avatarUrl: string | null; authMode: string }> {
  const res = await fetch(`${API_BASE}/api/me`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
  return res.json();
}

// ─── Per-project design system ───

export async function fetchDesignSystem<T = unknown>(projectId: string): Promise<T | null> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/design-system`, { headers: await getAuthHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch design system: ${res.status}`);
  const body = await res.json();
  return (body?.designSystem ?? null) as T | null;
}

export async function saveDesignSystem<T = unknown>(projectId: string, designSystem: T): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/design-system`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(designSystem),
  });
  if (!res.ok) throw new Error(`Failed to save design system: ${res.status}`);
}
