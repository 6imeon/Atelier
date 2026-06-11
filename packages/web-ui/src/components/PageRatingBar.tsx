import { useState, useEffect } from "react";
import { useCanvasStore } from "../stores/canvas-store";
import { apiRatePage } from "../utils/feedback";

/**
 * Non-intrusive page rating bar shown after generation completes.
 * Appears as a floating toast in the bottom-center area.
 * 1-5 stars, dismissable, auto-hides after rating.
 */
export function PageRatingBar() {
  const { project, screens, isGenerating, agentTasks } = useCanvasStore();
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [lastTaskCount, setLastTaskCount] = useState(0);

  // Show rating bar when a generation just completed
  const completedCount = agentTasks.filter(t => t.status === "done").length;
  useEffect(() => {
    if (completedCount > lastTaskCount && !isGenerating) {
      setVisible(true);
      setRating(0);
      setHovered(0);
      setSubmitted(false);
      setDismissed(false);
    }
    setLastTaskCount(completedCount);
  }, [completedCount, isGenerating]);

  // Auto-hide after 30 seconds if not interacted with
  useEffect(() => {
    if (!visible || submitted || dismissed) return;
    const timer = setTimeout(() => setDismissed(true), 30000);
    return () => clearTimeout(timer);
  }, [visible, submitted, dismissed]);

  if (!visible || dismissed || screens.length === 0) return null;

  const handleRate = (stars: number) => {
    setRating(stars);
    setSubmitted(true);
    // Send to API
    const lastScreen = screens[screens.length - 1];
    if (project && lastScreen) {
      apiRatePage(project.id, lastScreen.id, stars);
    }
    // Auto-hide after brief delay
    setTimeout(() => setDismissed(true), 1500);
  };

  const starColor = "var(--accent, #7c5cfc)";
  const mutedColor = "var(--chrome-text-muted, #999)";

  return (
    <div style={{
      position: "fixed",
      bottom: 56,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 95,
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 16px",
      borderRadius: 12,
      background: "var(--chrome-bg, #fff)",
      border: "1px solid var(--chrome-border, #e5e5e5)",
      boxShadow: "var(--shadow-lg, 0 4px 12px rgba(0,0,0,0.1))",
      animation: "slideUp 0.3s ease",
      fontSize: 13,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {submitted ? (
        <span style={{ color: "var(--chrome-text, #333)", fontWeight: 500 }}>
          Thanks! Your rating improves future designs.
        </span>
      ) : (
        <>
          <span style={{ color: "var(--chrome-text-secondary, #666)", fontSize: 12 }}>
            How did this turn out?
          </span>
          <div style={{ display: "flex", gap: 2 }}>
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  fontSize: 18,
                  color: star <= (hovered || rating) ? starColor : mutedColor,
                  transition: "color 0.15s, transform 0.1s",
                  transform: star <= hovered ? "scale(1.15)" : "scale(1)",
                }}
              >
                {star <= (hovered || rating) ? "\u2605" : "\u2606"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Skip rating"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: mutedColor,
              fontSize: 11,
              padding: "2px 6px",
            }}
          >
            Skip
          </button>
        </>
      )}
    </div>
  );
}
