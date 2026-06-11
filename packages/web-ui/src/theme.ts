import { create } from "zustand";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (typeof localStorage !== "undefined" && localStorage.getItem("canvas-theme") as Theme) || "light",
  toggle: () => set((s) => {
    const next = s.theme === "light" ? "dark" : "light";
    localStorage.setItem("canvas-theme", next);
    document.documentElement.setAttribute("data-theme", next);
    return { theme: next };
  }),
  set: (t) => {
    localStorage.setItem("canvas-theme", t);
    document.documentElement.setAttribute("data-theme", t);
    set({ theme: t });
  },
}));

// Apply on load
if (typeof document !== "undefined") {
  const saved = localStorage.getItem("canvas-theme") as Theme | null;
  document.documentElement.setAttribute("data-theme", saved || "light");
}
