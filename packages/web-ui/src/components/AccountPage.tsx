import { useState, useEffect } from "react";
import { fetchMe, fetchProjects } from "../utils/api";
import { getMsalInstance, entraEnabled } from "../auth/msalConfig";
import { AtelierLogo } from "./AtelierLogo";

// Dusty Rose palette (design D — Full-Width Sections)
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

interface UserProfile {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  roles?: string[];
  createdAt?: string;
  lastLogin?: string;
  authMode: string;
}

interface Props {
  onBack: () => void;
}

export function AccountPage({ onBack }: Props) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<{ total: number; expiring: number; screens: number }>({ total: 0, expiring: 0, screens: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [me, projectsRes] = await Promise.all([
          fetchMe(),
          fetchProjects({ limit: 100 }),
        ]);
        setUser(me as UserProfile);

        const now = Date.now();
        const cutoff = now - 25 * 24 * 60 * 60 * 1000; // 5 days until expiry
        const expiring = projectsRes.projects.filter(p =>
          p.lastAccessedAt && new Date(p.lastAccessedAt).getTime() < cutoff
        ).length;
        setStats({
          total: projectsRes.projects.length,
          expiring,
          screens: 0, // Would need per-project screen counts
        });
      } catch {
        // Failed to load
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleLogout = async () => {
    if (entraEnabled) {
      const msal = getMsalInstance();
      if (msal) {
        await msal.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
        return;
      }
    }
    sessionStorage.removeItem("atelier-api-key");
    window.location.hash = "";
    window.location.reload();
  };

  const initials = user?.displayName?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: P.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ color: P.t3, fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: P.bg, color: P.t1, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{
        height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", borderBottom: `1px solid ${P.bd}`, background: P.card,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <AtelierLogo size="sm" color={P.t1} onClick={onBack} />
          <div
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: P.t3, fontSize: 12, fontWeight: 500, marginLeft: 8 }}
            onMouseEnter={e => e.currentTarget.style.color = P.t1}
            onMouseLeave={e => e.currentTarget.style.color = P.t3}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Projects
          </div>
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: "50%", background: P.ac,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 600, color: "#fff",
        }}>{initials}</div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "28px 20px" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>Account</div>

        {/* Profile section */}
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${P.bd}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", background: P.ac,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 600, color: "#fff", flexShrink: 0,
            }}>{initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{user?.displayName}</div>
              <div style={{ fontSize: 12, color: P.t3 }}>{user?.email ?? "—"}</div>
            </div>
            {user?.authMode === "entra" && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 7,
                background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.1)",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, width: 14, height: 14 }}>
                  <div style={{ background: "#f25022", borderRadius: 1 }} />
                  <div style={{ background: "#7fba00", borderRadius: 1 }} />
                  <div style={{ background: "#00a4ef", borderRadius: 1 }} />
                  <div style={{ background: "#ffb900", borderRadius: 1 }} />
                </div>
                <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 500 }}>Entra ID</span>
              </div>
            )}
          </div>
        </div>

        {/* Details section */}
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${P.bd}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: P.t3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Role</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.roles?.join(", ") ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: P.t3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Member Since</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: P.t3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Last Login</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.lastLogin ? new Date(user.lastLogin).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</div>
            </div>
          </div>
        </div>

        {/* Usage section */}
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${P.bd}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Usage</div>
          <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.total}</div>
              <div style={{ fontSize: 11, color: P.t3, fontWeight: 500 }}>Projects</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: stats.expiring > 0 ? "#f59e0b" : P.t1 }}>{stats.expiring}</div>
              <div style={{ fontSize: 11, color: P.t3, fontWeight: 500 }}>Expiring</div>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${P.bd}` }}>
          <button onClick={handleLogout} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 16px", borderRadius: 8, border: `1px solid ${P.bd}`,
            background: P.card, color: P.t2, fontSize: 13, fontWeight: 500,
            fontFamily: "inherit", cursor: "pointer", width: "100%",
            transition: "background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = P.sf}
            onMouseLeave={e => e.currentTarget.style.background = P.card}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>

        {/* Danger zone */}
        <div style={{
          padding: "14px 16px", borderRadius: 10,
          border: "1px solid rgba(220,38,38,0.12)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 13, color: P.t2 }}>Permanently delete account</span>
          <button style={{
            padding: "6px 12px", borderRadius: 6,
            border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.06)",
            color: "#dc2626", fontSize: 12, fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
          }}>Delete</button>
        </div>
      </div>
    </div>
  );
}
