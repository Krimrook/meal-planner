// Small localStorage wrappers for per-device preferences (same try/catch
// reasoning as readStoredWeek in dateutils.js: storage can be unavailable,
// and a preference is never worth crashing a screen over).

// Whether recipes are scaled to household size on the Shopping List, Meal
// Plan and Welcome screens. Shared key so all three always agree.
export const SCALE_PREF_KEY = 'scaleToHousehold';

export function readStoredFlag(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

export function writeStoredFlag(key, value) {
  try {
    localStorage.setItem(key, String(!!value));
  } catch {
    // best-effort only
  }
}
