import ReactDOM from "react-dom/client";
import App from "./App";
import "./theme"; // Initialize theme on load

// Prevent browser-level zoom (Ctrl+scroll, Ctrl+/-, pinch) — app has its own canvas zoom
document.addEventListener("wheel", (e) => {
  if (e.ctrlKey || e.metaKey) e.preventDefault();
}, { passive: false });
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")) {
    e.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// Dev console utility: window.__loadTestFixtures() / window.__clearTestFixtures()
if (import.meta.env.DEV) {
  (window as any).__loadTestFixtures = () => import("./test-fixtures").then(m => m.loadTestFixtures());
  (window as any).__clearTestFixtures = () => import("./test-fixtures").then(m => m.clearTestFixtures());
}
