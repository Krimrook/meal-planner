// Aggregation helpers for the Shopping List — pulled out of ShoppingList.js so
// the grouping/rounding logic can be unit tested directly, without needing to
// render the component or talk to Supabase.

// Rounds to 2dp and strips trailing zeros so summed quantities don't show as
// 0.30000000000000004 (classic floating point addition artifact).
export function trimNumber(n) {
  return Number(n.toFixed(2)).toString();
}

// Folds one ingredient occurrence into the running groups map. Ingredients are grouped
// by name+unit (case-insensitive) so "200g chicken breast" x2 becomes one 400g line.
// Ingredients with no quantity still get grouped by name, just without a numeric
// total — they fall back to the old "name ×N" display.
export function addToGroups(groups, rawName, rawUnit, rawQuantity) {
  const name = (rawName || '').trim();
  if (!name) return;
  const unit = (rawUnit || '').trim();
  const key = `${name.toLowerCase()}|${unit.toLowerCase()}`;

  if (!groups[key]) {
    groups[key] = { key, name, unit, totalQty: 0, hasQty: false, count: 0 };
  }
  groups[key].count += 1;

  const qty = rawQuantity !== null && rawQuantity !== undefined && rawQuantity !== '' ? Number(rawQuantity) : null;
  if (qty !== null && !Number.isNaN(qty)) {
    groups[key].totalQty += qty;
    groups[key].hasQty = true;
  }
}

// Turns the raw groups map into the sorted, display-ready item list the
// Shopping List renders. Split out from the component so the whole
// fetch → group → format pipeline is testable end to end without Supabase.
export function groupsToItems(groups) {
  return Object.values(groups)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => ({
      key: g.key,
      label: g.hasQty ? `${trimNumber(g.totalQty)}${g.unit ? ' ' + g.unit : ''} ${g.name}` : g.name,
      count: g.count,
      showCount: !g.hasQty && g.count > 1,
    }));
}