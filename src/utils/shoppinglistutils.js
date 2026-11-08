// Aggregation helpers for the Shopping List — pulled out of ShoppingList.js so
// the grouping/rounding logic can be unit tested directly, without needing to
// render the component or talk to Supabase.

import { AISLES, DEFAULT_AISLE, AISLE_QUALIFIERS, AISLE_KEYWORDS } from './constants.js';
import { buildKeywordIndex, findKeyword } from './matchUtils.js';

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
      name: g.name,
      label: g.hasQty ? `${trimNumber(g.totalQty)}${g.unit ? ' ' + g.unit : ''} ${g.name}` : g.name,
      count: g.count,
      showCount: !g.hasQty && g.count > 1,
      // Raw numbers kept alongside the display label so the item can be
      // costed (priceUtils.js) without re-parsing the label text.
      unit: g.unit,
      quantity: g.hasQty ? g.totalQty : null,
    }));
}

// --- Aisle grouping ---------------------------------------------------------

const QUALIFIER_INDEX = buildKeywordIndex(
  Object.entries(AISLE_QUALIFIERS).map(([keyword, aisle]) => ({ keyword, aisle }))
);

// Every keyword from every aisle, flattened into one list, longest first.
// Built once when the module loads, not on every guessAisle() call.
const KEYWORD_INDEX = buildKeywordIndex(
  Object.entries(AISLE_KEYWORDS).flatMap(([aisle, keywords]) => keywords.map((keyword) => ({ aisle, keyword })))
);

// Best-guess aisle for an ingredient name, from the keyword lists in
// constants.js. Returns DEFAULT_AISLE ('Other') when nothing matches — it's a
// starting point for the user to correct, not something that has to be right.
export function guessAisle(rawName) {
  const qualifier = findKeyword(QUALIFIER_INDEX, rawName);
  if (qualifier) return qualifier.aisle;

  const hit = findKeyword(KEYWORD_INDEX, rawName);
  return hit ? hit.aisle : DEFAULT_AISLE;
}

// Splits the display-ready items into aisle sections, in AISLES order, leaving
// out any aisle with nothing in it. `overrides` is an optional
// { 'ingredient name in lowercase': 'Aisle' } map that beats the guess — an
// override naming an aisle that isn't in AISLES is ignored rather than trusted.
// Items keep their alphabetical order (from groupsToItems) within each aisle.
export function groupsToSections(groups, overrides = {}) {
  const byAisle = {};

  groupsToItems(groups).forEach((item) => {
    const override = overrides[item.name.toLowerCase()];
    const aisle = AISLES.includes(override) ? override : guessAisle(item.name);
    if (!byAisle[aisle]) byAisle[aisle] = [];
    byAisle[aisle].push({ ...item, aisle });
  });

  return AISLES.filter((aisle) => byAisle[aisle]).map((aisle) => ({ aisle, items: byAisle[aisle] }));
}