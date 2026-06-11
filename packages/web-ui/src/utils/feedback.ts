/**
 * Send implicit user feedback to the analytics layer.
 * Non-blocking — fire and forget. Never impacts UI.
 */

import { API_BASE, getAuthHeaders } from "./api";

type FeedbackAction = "kept" | "deleted" | "edited" | "exported" | "variant_created";

export function sendFeedback(
  projectId: string,
  screenId: string,
  action: FeedbackAction,
  extra?: { editDelta?: { sectionsModified?: number; htmlDiffSize?: number }; timeToAction?: number; html?: string; sectionRatings?: Array<{ sectionType: string; vote: "up" | "down" }> },
): void {
  getAuthHeaders().then(headers => {
    fetch(`${API_BASE}/api/feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        projectId,
        screenId,
        action,
        ...extra,
      }),
    }).catch(() => {}); // silent — never block UI
  }).catch(() => {});
}

/** Rate a full page (1-5 stars) */
export function apiRatePage(projectId: string, screenId: string, rating: number): void {
  getAuthHeaders().then(headers => {
    fetch(`${API_BASE}/api/projects/${projectId}/screens/${screenId}/rate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ projectId, screenId, rating }),
    }).catch(() => {});
  }).catch(() => {});
}

/** Rate an individual section (thumbs up/down) */
export function apiRateSection(projectId: string, screenId: string, sectionType: string, vote: "up" | "down"): void {
  getAuthHeaders().then(headers => {
    fetch(`${API_BASE}/api/projects/${projectId}/screens/${screenId}/rate-section`, {
      method: "POST",
      headers,
      body: JSON.stringify({ sectionType, vote }),
    }).catch(() => {});
  }).catch(() => {});
}
