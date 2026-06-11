import { useState, useEffect, useCallback } from "react";
import { TopBar } from "./components/TopBar";
import { ChatPanel } from "./components/ChatPanel";
import { ResultPanel } from "./components/ResultPanel";
import { InfiniteCanvas } from "./components/InfiniteCanvas";
import { Toolbar } from "./components/Toolbar";
import { RightToolbar } from "./components/RightToolbar";
import { DesignPanel } from "./components/DesignPanel";
import { ComponentBrowser } from "./components/ComponentBrowser";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProjectLibrary } from "./components/ProjectLibrary";
import { NewProjectModal } from "./components/NewProjectModal";
import { LoginPage } from "./components/LoginPage";
import { AccountPage } from "./components/AccountPage";
import { PageRatingBar } from "./components/PageRatingBar";
import { RankPage } from "./components/RankPage";
import { ReviewPage } from "./components/ReviewPage";
import { PlaygroundPage } from "./components/PlaygroundPage";
import type { StartType } from "./components/NewProjectModal";
import { createProject, fetchMe, fetchProject, fetchScreen, touchProject, fetchDesignSystem, saveDesignSystem } from "./utils/api";
import {
  useCanvasStore,
  loadDesignSystemForProject,
  readLegacyDesignSystem,
  clearLegacyDesignSystem,
  type CanvasDesignSystem,
} from "./stores/canvas-store";
import { getMsalInstance, entraEnabled } from "./auth/msalConfig";
import { MsalProvider } from "@azure/msal-react";

type Route = { view: "library" } | { view: "editor"; projectId: string } | { view: "account" } | { view: "rank" } | { view: "review" } | { view: "playground" };

function parseRoute(): Route {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith("/project/")) {
    return { view: "editor", projectId: hash.slice("/project/".length) };
  }
  if (hash === "/account") {
    return { view: "account" };
  }
  if (hash === "/rank") {
    return { view: "rank" };
  }
  if (hash === "/review") {
    return { view: "review" };
  }
  if (hash === "/playground") {
    return { view: "playground" };
  }
  return { view: "library" };
}

function navigate(path: string) {
  window.location.hash = path;
}

function AppInner() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const [componentBrowserOpen, setComponentBrowserOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [user, setUser] = useState<{ displayName: string; email?: string | null } | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null); // null = loading
  const [apiKeyOverride, setApiKeyOverride] = useState<string | null>(null);

  // Listen for hash changes
  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Handle MSAL redirect response on app load
  useEffect(() => {
    const init = async () => {
      if (entraEnabled) {
        const msal = getMsalInstance();
        if (msal) {
          try {
            await msal.initialize();
            await msal.handleRedirectPromise();
            const accounts = msal.getAllAccounts();
            if (accounts.length > 0) {
              setAuthenticated(true);
              fetchMe().then(setUser).catch(() => {});
              return;
            }
          } catch {
            // MSAL init failed, fall through
          }
        }
      }

      // API key mode: probe the server. Succeeds when the server is open
      // (no key configured) or when a valid key is available from the env
      // or a previous login this session; otherwise show the login page.
      try {
        const me = await fetchMe();
        setUser(me);
        setAuthenticated(true);
      } catch {
        setAuthenticated(false);
      }
    };
    init();
  }, [apiKeyOverride]);

  // Prevent browser zoom globally
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    document.addEventListener("wheel", preventBrowserZoom, { passive: false });
    return () => document.removeEventListener("wheel", preventBrowserZoom);
  }, []);

  // Auto-load test fixtures via ?test=true URL parameter
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("test") === "true") {
      import("./test-fixtures").then(m => m.loadTestFixtures());
    }
  }, []);

  // Touch project periodically while in editor
  useEffect(() => {
    if (route.view !== "editor") return;
    touchProject(route.projectId).catch(() => {});
    const interval = setInterval(() => {
      touchProject(route.projectId).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [route]);

  const handleOpenProject = useCallback(async (id: string) => {
    const store = useCanvasStore.getState();
    // Set project immediately so the editor renders. setProject resets
    // design-system state when the pid changes, so no leaks from the prior
    // project survive this call.
    store.setProject({ id, title: "", screens: [] });
    navigate(`/project/${id}`);

    // Paint-fast: seed the store from the per-project localStorage cache
    // while the server round-trip is in flight.
    const cached = loadDesignSystemForProject(id);
    useCanvasStore.setState({ designSystem: cached });

    // Fetch design system in parallel with screens.
    const dsPromise = fetchDesignSystem<CanvasDesignSystem>(id).catch(() => null);

    try {
      const project = await fetchProject(id);
      const screenPromises = project.screens.map(s => fetchScreen(id, s.id));
      const screenData = await Promise.all(screenPromises);

      // Match ChatPanel's screen dimensions exactly
      const SCREEN_W = 1440;
      const SCREEN_H = 4000;
      const SCALE = 0.3;
      const GAP = 40;
      const GRID_OFFSET_X = 630;
      const screens = screenData.map((s, i) => {
        const deviceType = (s.deviceType || "DESKTOP") as "MOBILE" | "DESKTOP" | "TABLET" | "AGNOSTIC";
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cardW = SCREEN_W * SCALE;
        return {
          id: s.screenId,
          projectId: id,
          prompt: s.prompt,
          html: s.html,
          deviceType,
          x: col * (cardW + GAP) + GRID_OFFSET_X,
          y: row * (SCREEN_H * SCALE + GAP + 40) + GAP,
          width: SCREEN_W,
          height: SCREEN_H,
        };
      });

      store.setProject({ id, title: project.title, screens });

      // Reconcile design system: server wins. If the server returns null and
      // a legacy pre-per-project blob exists, one-shot seed from it so the
      // user's single "saved" design system isn't lost on upgrade.
      const serverDs = await dsPromise;
      let effectiveDs: CanvasDesignSystem | null = serverDs ?? null;
      if (!effectiveDs) {
        const legacy = readLegacyDesignSystem();
        if (legacy) {
          effectiveDs = legacy;
          clearLegacyDesignSystem();
          // Persist the migrated system to the server for this project so
          // it survives future loads; subsequent projects get a clean default.
          saveDesignSystem(id, legacy).catch(() => {});
        }
      }
      if (effectiveDs) {
        useCanvasStore.setState({ designSystem: effectiveDs });
        try { localStorage.setItem(`atelier-design-system:${id}`, JSON.stringify(effectiveDs)); } catch {}
      }

      // Restore design system card on canvas for any project with screens.
      // Every project gets its own card — server DS if saved, otherwise the
      // store's current designSystem (defaults applied). Unconditional: no
      // stale-card guard, because setProject already cleared extractedTokens
      // on project switch.
      if (screens.length > 0) {
        const ds = useCanvasStore.getState().designSystem;
        useCanvasStore.setState({
          extractedTokens: {
            tokens: {
              primaryColor: ds.palette?.primary,
              secondaryColor: ds.palette?.secondary,
              headlineFont: ds.fonts?.headline,
              bodyFont: ds.fonts?.body,
              cornerRadius: ds.cornerRadius,
            },
            x: screens[0].x - 380,
            y: screens[0].y,
          },
        });
      }
    } catch (e) {
      console.error("Failed to load project screens:", e);
    }
  }, []);

  const handleCreateProject = useCallback(async (title: string, _startType: StartType) => {
    try {
      const p = await createProject(title);
      const store = useCanvasStore.getState();
      // setProject resets extractedTokens/designSystem/marks on pid change.
      store.setProject({ id: p.id, title: p.title, screens: [] });
      setNewProjectOpen(false);
      navigate(`/project/${p.id}`);
    } catch (e) {
      console.error("Failed to create project:", e);
    }
  }, []);

  const handleBackToLibrary = useCallback(() => {
    navigate("/");
  }, []);

  const handleApiKeyLogin = useCallback(async (key: string) => {
    // Store key in sessionStorage so apiHeaders() can use it, then verify it
    // against the server before letting the user in.
    sessionStorage.setItem("atelier-api-key", key);
    try {
      const me = await fetchMe();
      setUser(me);
      setApiKeyOverride(key);
      setAuthenticated(true);
    } catch {
      sessionStorage.removeItem("atelier-api-key");
      throw new Error("Invalid API key");
    }
  }, []);

  // Loading state
  if (authenticated === null) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#FAF8F9", fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: "center", color: "#A89BA0", fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  // Login page
  if (!authenticated) {
    return <LoginPage onApiKeyLogin={handleApiKeyLogin} />;
  }

  // ─── Account View ───
  if (route.view === "account") {
    return <AccountPage onBack={handleBackToLibrary} />;
  }

  // ─── Rank View ───
  if (route.view === "rank") {
    return <RankPage onBack={handleBackToLibrary} />;
  }

  // ─── Review View ───
  if (route.view === "review") {
    return <ReviewPage onBack={handleBackToLibrary} />;
  }

  // ─── Playground View ───
  if (route.view === "playground") {
    return <PlaygroundPage onBack={handleBackToLibrary} />;
  }

  // ─── Library View ───
  if (route.view === "library") {
    return (
      <>
        <ProjectLibrary
          onOpenProject={handleOpenProject}
          onNewProject={() => setNewProjectOpen(true)}
          user={user}
        />
        <NewProjectModal
          open={newProjectOpen}
          onClose={() => setNewProjectOpen(false)}
          onCreate={handleCreateProject}
        />
      </>
    );
  }

  // ─── Editor View ───
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TopBar onOpenComponents={() => setComponentBrowserOpen(true)} onBackToLibrary={handleBackToLibrary} />
      <div style={{ flex: 1, position: "relative", marginTop: 48 }}>
        <ErrorBoundary fallbackLabel="Canvas">
          <InfiniteCanvas />
        </ErrorBoundary>
      </div>
      <ErrorBoundary fallbackLabel="Result Panel">
        <ResultPanel />
      </ErrorBoundary>
      <ErrorBoundary fallbackLabel="Chat Panel">
        <ChatPanel />
      </ErrorBoundary>
      <Toolbar />
      <PageRatingBar />
      <RightToolbar />
      <ErrorBoundary fallbackLabel="Design Panel">
        <DesignPanel />
      </ErrorBoundary>
      <ErrorBoundary fallbackLabel="Component Browser">
        <ComponentBrowser open={componentBrowserOpen} onClose={() => setComponentBrowserOpen(false)} />
      </ErrorBoundary>
    </div>
  );
}

export default function App() {
  const msal = getMsalInstance();

  // Wrap in MsalProvider only if Entra is configured
  if (msal) {
    return (
      <MsalProvider instance={msal}>
        <AppInner />
      </MsalProvider>
    );
  }

  return <AppInner />;
}
