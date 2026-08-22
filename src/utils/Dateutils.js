// Date helpers shared by MealPlanGrid and ShoppingList — pulled out here so both
// stay in sync instead of maintaining two identical copies (same reasoning as
// constants.js from Day 3), and so the date math itself can be unit tested
// without needing to render either component.

export function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDayLabel(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatRangeLabel(start, end) {
  const startLabel = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endLabel = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

// Parses a ?week= URL param into a valid Monday, falling back to the current
// week for anything missing or malformed (e.g. a hand-edited URL).
export function weekStartFromParam(param) {
  if (param) {
    const parsed = new Date(param);
    if (!Number.isNaN(parsed.getTime())) {
      return getMonday(parsed);
    }
  }
  return getMonday(new Date());
}