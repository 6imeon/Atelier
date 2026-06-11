import { PublicClientApplication, Configuration, LogLevel } from "@azure/msal-browser";

// Single app registration — one client ID for both SPA and API
const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || "";
const TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || "";

// Master gate for Microsoft 365 / Entra ID sign-in. Set VITE_ENTRA_ENABLED=false
// to hide the Microsoft button and use local API-key login even when the
// Azure client/tenant IDs are configured.
const ENTRA_GATE = (import.meta.env.VITE_ENTRA_ENABLED ?? "true") !== "false";

/** Whether Entra auth is enabled (gated + configured) */
export const entraEnabled = ENTRA_GATE && Boolean(CLIENT_ID && TENANT_ID);

const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: (_level, message) => {
        if (import.meta.env.DEV) console.debug("[msal]", message);
      },
    },
  },
};

export const loginRequest = {
  // Use User.Read (Microsoft Graph) — pre-consented, gives refreshable access tokens
  // We don't actually call Graph — we just need a refreshable token
  // The ID token (returned alongside the access token) contains user info + roles
  scopes: ["User.Read"],
};

// Singleton MSAL instance — only created if Entra is configured
let _instance: PublicClientApplication | null = null;

export function getMsalInstance(): PublicClientApplication | null {
  if (!entraEnabled) return null;
  if (!_instance) {
    _instance = new PublicClientApplication(msalConfig);
  }
  return _instance;
}
