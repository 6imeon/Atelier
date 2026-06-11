export const DEBUG = import.meta.env.DEV || import.meta.env.VITE_DEBUG === "true";

export function debugLog(prefix: string, ...args: unknown[]) {
  if (DEBUG) console.log(`[${prefix}]`, ...args);
}
