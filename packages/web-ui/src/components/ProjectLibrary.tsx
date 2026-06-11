import { useState, useEffect, useCallback } from "react";
import { fetchProjects, deleteProject, type ProjectSummary } from "../utils/api";
import { getMsalInstance, entraEnabled } from "../auth/msalConfig";
import { AtelierLogo } from "./AtelierLogo";

// Dusty Rose palette (design D — Kanban Board)
const P = {
  bg: "var(--pl-bg, #FAF8F9)",
  sf: "var(--pl-sf, #F4F0F2)",
  card: "var(--pl-card, #FFFFFF)",
  bd: "var(--pl-bd, #E8E1E4)",
  t1: "var(--pl-t1, #1F1A1C)",
  t2: "var(--pl-t2, #6B5F64)",
  t3: "var(--pl-t3, #A89BA0)",
  ac: "var(--pl-ac, #9F5474)",
};

function daysUntilExpiry(lastAccessedAt: string | null | undefined): number | null {
  if (!lastAccessedAt) return null;
  const accessed = new Date(lastAccessedAt).getTime();
  const expiry = accessed + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type StatusGroup = "active" | "expiring" | "critical";

function groupProjects(projects: ProjectSummary[]): Record<StatusGroup, ProjectSummary[]> {
  const groups: Record<StatusGroup, ProjectSummary[]> = { active: [], expiring: [], critical: [] };
  for (const p of projects) {
    const days = daysUntilExpiry(p.lastAccessedAt);
    if (days === null || days > 5) groups.active.push(p);
    else if (days > 1) groups.expiring.push(p);
    else groups.critical.push(p);
  }
  return groups;
}

interface Props {
  onOpenProject: (id: string) => void;
  onNewProject: () => void;
  user?: { displayName: string; email?: string | null } | null;
}

export function ProjectLibrary({ onOpenProject, onNewProject, user }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchProjects({ limit: 100 });
      setProjects(res.projects);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      setProjects(ps => ps.filter(p => p.id !== id));
      setDeleteConfirm(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const filtered = search
    ? projects.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
    : projects;
  const groups = groupProjects(filtered);

  const initials = user?.displayName?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  return (
    <div style={{ minHeight: "100vh", background: P.bg, color: P.t1, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{
        height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", borderBottom: `1px solid ${P.bd}`, background: P.card,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <AtelierLogo size="sm" color={P.t1} />
        <UserMenu displayName={user?.displayName} initials={initials} />
      </div>

      {/* Controls */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => {}} style={{
              padding: "6px 14px", borderRadius: 7, border: `1px solid ${P.bd}`,
              background: P.sf, color: P.t1, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>Board</button>
            {/* Search */}
            <div style={{
              display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 7,
              background: P.sf, border: `1px solid ${P.bd}`, width: 220,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.t3} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search projects..."
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: P.t1, fontFamily: "inherit" }}
              />
            </div>
          </div>
          <button onClick={onNewProject} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: P.ac, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Project
          </button>
        </div>

        {loading && <div style={{ textAlign: "center", padding: 40, color: P.t3, fontSize: 14 }}>Loading projects...</div>}
        {error && <div style={{ textAlign: "center", padding: 40, color: "#dc2626", fontSize: 14 }}>{error}</div>}

        {!loading && !error && (
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            {(["active", "expiring", "critical"] as StatusGroup[]).map(status => (
              <Column
                key={status}
                status={status}
                projects={groups[status]}
                onOpen={onOpenProject}
                onDelete={id => setDeleteConfirm(id)}
                onNewProject={status === "active" ? onNewProject : undefined}
              />
            ))}
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: P.t3 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={P.t3} strokeWidth="1" style={{ marginBottom: 12, opacity: 0.5 }}>
              <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><path d="M9 21V9"/>
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600, color: P.t1, marginBottom: 4 }}>No projects yet</div>
            <div style={{ fontSize: 13, marginBottom: 16 }}>Create your first project to get started.</div>
            <button onClick={onNewProject} style={{
              padding: "9px 20px", borderRadius: 8, border: "none",
              background: P.ac, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>Create Project</button>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setDeleteConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 340, padding: "24px", borderRadius: 14, background: P.card,
            border: `1px solid ${P.bd}`, boxShadow: "0 16px 48px rgba(0,0,0,0.1)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: P.t1 }}>Delete project?</div>
            <div style={{ fontSize: 13, color: P.t2, marginBottom: 20, lineHeight: 1.5 }}>
              This will permanently delete the project and all its screens. This action cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{
                padding: "8px 16px", borderRadius: 8, border: `1px solid ${P.bd}`,
                background: P.card, color: P.t2, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.3)",
                background: "rgba(220,38,38,0.08)", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kanban Column ───

const STATUS_CONFIG = {
  active: { label: "Active", barColor: "#22c55e" },
  expiring: { label: "Expiring", barColor: "#f59e0b" },
  critical: { label: "Critical", barColor: "#ef4444" },
};

function Column({ status, projects, onOpen, onDelete, onNewProject }: {
  status: StatusGroup;
  projects: ProjectSummary[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNewProject?: () => void;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 10px", marginBottom: 8, fontSize: 12, fontWeight: 600, color: P.t2,
      }}>
        {config.label}
        <span style={{
          fontSize: 11, fontWeight: 400, color: P.t3, padding: "1px 7px",
          borderRadius: 4, background: P.sf,
        }}>{projects.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {projects.map(p => (
          <ProjectCard key={p.id} project={p} barColor={config.barColor} onOpen={onOpen} onDelete={onDelete} />
        ))}
        {onNewProject && (
          <div onClick={onNewProject} style={{
            padding: 12, borderRadius: 9, border: `1.5px dashed ${P.bd}`,
            textAlign: "center", fontSize: 12, color: P.t3, fontWeight: 500,
            cursor: "pointer", transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = P.ac; e.currentTarget.style.color = P.ac; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = P.bd; e.currentTarget.style.color = P.t3; }}
          >+ New Project</div>
        )}
      </div>
    </div>
  );
}

// ─── Project Card ───

function ProjectCard({ project, barColor, onOpen, onDelete }: {
  project: ProjectSummary;
  barColor: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const days = daysUntilExpiry(project.lastAccessedAt);
  const ago = project.lastAccessedAt ? timeAgo(project.lastAccessedAt) : "—";

  return (
    <div
      onClick={() => onOpen(project.id)}
      style={{
        padding: 14, borderRadius: 10, background: P.card,
        border: `1px solid ${P.bd}`, cursor: "pointer", transition: "all 0.15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 3px 12px rgba(0,0,0,0.06)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: P.t1, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {project.title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: P.t3 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          {project.screenCount ?? 0}
        </span>
        <span>{ago}</span>
        {days !== null && days <= 5 && (
          <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 3, background: days <= 1 ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", color: days <= 1 ? "#dc2626" : "#d97706" }}>
            {days <= 0 ? "Expired" : `${days}d`}
          </span>
        )}
      </div>
      <div style={{ height: 3, borderRadius: 2, marginTop: 10, background: barColor }} />
      {/* Actions row (shown always, compact) */}
      <div style={{ display: "flex", gap: 4, marginTop: 8 }} onClick={e => e.stopPropagation()}>
        <button onClick={() => onOpen(project.id)} style={{
          flex: 1, padding: "5px 0", borderRadius: 5, border: `1px solid ${P.bd}`,
          background: P.card, color: P.t2, fontSize: 10, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}>Open</button>
        <button onClick={() => onDelete(project.id)} style={{
          padding: "5px 8px", borderRadius: 5, border: `1px solid ${P.bd}`,
          background: P.card, color: P.t3, fontSize: 10, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─── User Menu (avatar + dropdown with sign out) ───

function UserMenu({ displayName, initials }: { displayName?: string; initials: string }) {
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    if (entraEnabled) {
      const msal = getMsalInstance();
      if (msal) {
        await msal.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
        return;
      }
    }
    // API key mode — clear session and reload
    sessionStorage.removeItem("atelier-api-key");
    window.location.hash = "";
    window.location.reload();
  };

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 12, color: P.t3 }}>{displayName}</span>
      <div
        onClick={() => setOpen(!open)}
        style={{
          width: 30, height: 30, borderRadius: "50%", background: P.ac,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 600, color: "#fff", cursor: "pointer",
        }}
      >{initials}</div>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: 38, right: 0, zIndex: 100,
            width: 180, padding: 4, borderRadius: 10,
            background: P.card, border: `1px solid ${P.bd}`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          }}>
            <div style={{
              padding: "8px 12px", fontSize: 12, color: P.t2, borderBottom: `1px solid ${P.bd}`,
              marginBottom: 4,
            }}>
              <div style={{ fontWeight: 600, color: P.t1 }}>{displayName}</div>
            </div>
            <div
              onClick={() => { setOpen(false); window.location.hash = "/account"; }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", borderRadius: 6, cursor: "pointer",
                fontSize: 13, color: P.t2, fontWeight: 500, transition: "background 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = P.sf}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Account
            </div>
            <div
              onClick={() => { setOpen(false); window.location.hash = "/rank"; }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", borderRadius: 6, cursor: "pointer",
                fontSize: 13, color: P.t2, fontWeight: 500, transition: "background 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = P.sf}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
              Rank Sections
            </div>
            <div
              onClick={() => { setOpen(false); window.location.hash = "/review"; }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", borderRadius: 6, cursor: "pointer",
                fontSize: 13, color: P.t2, fontWeight: 500, transition: "background 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = P.sf}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Review Components
            </div>
            <div
              onClick={() => { setOpen(false); window.location.hash = "/playground"; }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", borderRadius: 6, cursor: "pointer",
                fontSize: 13, color: P.t2, fontWeight: 500, transition: "background 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = P.sf}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>
              Playground
            </div>
            <div
              onClick={handleLogout}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", borderRadius: 6, cursor: "pointer",
                fontSize: 13, color: P.t2, fontWeight: 500, transition: "background 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = P.sf}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign Out
            </div>
          </div>
        </>
      )}
    </div>
  );
}
