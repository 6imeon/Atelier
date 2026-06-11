import { useState } from "react";
import { getMsalInstance, loginRequest, entraEnabled } from "../auth/msalConfig";
import { AtelierLogo } from "./AtelierLogo";

// Dusty Rose palette (design D — Ultra Minimal)
const P = {
  bg: "#FAF8F9",
  sf: "#F4F0F2",
  card: "#FFFFFF",
  bd: "#E8E1E4",
  t1: "#1F1A1C",
  t2: "#6B5F64",
  t3: "#A89BA0",
  ac: "#9F5474",
};

interface Props {
  onApiKeyLogin: (key: string) => Promise<void>;
}

export function LoginPage({ onApiKeyLogin }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEntraLogin = async () => {
    const msal = getMsalInstance();
    if (!msal) return;
    setLoading(true);
    setError(null);
    try {
      await msal.initialize();
      await msal.loginRedirect(loginRequest);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleApiKeySubmit = async () => {
    const key = apiKey.trim();
    if (!key) { setError("Please enter an API key"); return; }
    setLoading(true);
    setError(null);
    try {
      await onApiKeyLogin(key);
    } catch (e: any) {
      setError(e.message || "Invalid API key");
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: P.bg, display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ width: 300, textAlign: "center" }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <AtelierLogo size="lg" color={P.t1} />
        </div>
        <div style={{ fontSize: 13, color: P.t3, marginBottom: 32, lineHeight: 1.5 }}>
          AI design generation platform.<br/>Sign in to get started.
        </div>

        {/* Entra SSO button */}
        {entraEnabled && (
          <button onClick={handleEntraLogin} disabled={loading} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            background: P.ac, color: "#fff", fontSize: 15, fontWeight: 600,
            fontFamily: "inherit", cursor: loading ? "wait" : "pointer",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)", transition: "all 0.15s",
            opacity: loading ? 0.7 : 1,
          }}>
            {/* Microsoft icon */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, width: 16, height: 16 }}>
              <div style={{ background: "#f25022", borderRadius: 1 }} />
              <div style={{ background: "#7fba00", borderRadius: 1 }} />
              <div style={{ background: "#00a4ef", borderRadius: 1 }} />
              <div style={{ background: "#ffb900", borderRadius: 1 }} />
            </div>
            {loading ? "Redirecting..." : "Sign in with Microsoft"}
          </button>
        )}

        {/* Divider */}
        {entraEnabled && (
          <div style={{ fontSize: 12, color: P.t3, margin: "20px 0" }}>or enter API key</div>
        )}

        {/* API key input */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleApiKeySubmit()}
            placeholder="sk-atelier-..."
            style={{
              flex: 1, padding: "10px 12px", borderRadius: 8,
              border: `1px solid ${P.bd}`, background: P.sf, color: P.t1,
              fontSize: 12, fontFamily: "'SF Mono','Fira Code',monospace", outline: "none",
            }}
          />
          <button onClick={handleApiKeySubmit} disabled={loading} style={{
            padding: "10px 16px", borderRadius: 8, border: `1px solid ${P.bd}`,
            background: P.card, color: P.t2, fontSize: 12, fontWeight: 500,
            fontFamily: "inherit", cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}>{loading ? "Checking..." : "Connect"}</button>
        </div>

        {error && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#dc2626" }}>{error}</div>
        )}

        {/* Footer links */}
        <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 16, fontSize: 11 }}>
          <span style={{ color: P.t3 }}>Privacy</span>
          <span style={{ color: P.t3 }}>Terms</span>
          <span style={{ color: P.t3 }}>Docs</span>
        </div>
      </div>
    </div>
  );
}
