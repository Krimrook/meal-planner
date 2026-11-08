// Ingredient pricing: unit conversion, finding the right price for an
// ingredient, and costing a quantity of it two different ways:
//
//   usedCost — the share of a pack a recipe actually uses (200 g of a 1 kg bag
//              of rice = 20% of the price). Used for "cost per serving".
//   shopCost — what you actually pay at the till: whole packs, rounded up
//              (needing 1.2 kg of rice means buying two 1 kg bags). Used for
//              the weekly shopping total.
//
// Everything in here is pure (no React, no Supabase) so it's unit tested
// directly in priceUtils.test.js.

import { DEFAULT_PRICES } from './defaultPrices.js';
import { buildKeywordIndex, findKeyword } from './matchUtils.js';

// --- Units ------------------------------------------------------------------

// Every way a unit tends to get typed, mapped to one canonical spelling.
const UNIT_ALIASES = {
  g: 'g', gram: 'g', grams: 'g', gr: 'g', grm: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', kgs: 'kg',
  mg: 'mg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml', mls: 'ml',
  l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l', ltr: 'l',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', tsps: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp',
  cup: 'cup', cups: 'cup',
  pint: 'pint', pints: 'pint',
  // Things you count. "can"/"tin"/"slice"/"rasher" are all "one of these";
  // the price entry's eachAmount says how big one is.
  '': 'each', each: 'each', x: 'each', piece: 'each', pieces: 'each', whole: 'each',
  can: 'each', cans: 'each', tin: 'each', tins: 'each',
  slice: 'each', slices: 'each', rasher: 'each', rashers: 'each',
  fillet: 'each', fillets: 'each', large: 'each', medium: 'each', small: 'each',
};

// Conversion factors into each family's base unit (grams or millilitres).
const UNIT_INFO = {
  g: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  mg: { family: 'mass', factor: 0.001 },
  oz: { family: 'mass', factor: 28.35 },
  lb: { family: 'mass', factor: 453.6 },
  ml: { family: 'volume', factor: 1 },
  l: { family: 'volume', factor: 1000 },
  tsp: { family: 'volume', factor: 5 },
  tbsp: { family: 'volume', factor: 15 },
  cup: { family: 'volume', factor: 240 },
  pint: { family: 'volume', factor: 568 },
};

// "Cloves" → "clove", "Grams" → "g", "" → "each". Unknown units are
// lowercased and de-pluralised, so "cloves" and "clove" still line up.
export function normalizeUnit(rawUnit) {
  const unit = (rawUnit || '').trim().toLowerCase().replace(/\.$/, '');
  if (unit in UNIT_ALIASES) return UNIT_ALIASES[unit];
  return unit.endsWith('s') && unit.length > 3 ? unit.slice(0, -1) : unit;
}

// Converts a quantity into its family's base unit. Count-type units each get
// their own family ('count:each', 'count:clove') so cloves never get compared
// with bulbs by accident.
export function toBase(quantity, rawUnit) {
  const unit = normalizeUnit(rawUnit);
  const info = UNIT_INFO[unit];
  if (info) return { family: info.family, amount: quantity * info.factor };
  return { family: `count:${unit}`, amount: quantity };
}

const isMeasured = (family) => family === 'mass' || family === 'volume';

// How much of the pack's own base unit `quantity rawUnit` amounts to, or null
// if the two can't be compared. `approx` is true when we had to assume
// 1 g = 1 ml (fine for milk or oil, a bit rough for flour — and it only ever
// applies to small amounts in practice).
export function convertToPackUnits(quantity, rawUnit, price) {
  const need = toBase(quantity, rawUnit);
  const pack = toBase(price.packSize, price.packUnit);

  if (need.family === pack.family) return { amount: need.amount, approx: false };

  // Weight ↔ volume: assume roughly the density of water.
  if (isMeasured(need.family) && isMeasured(pack.family)) return { amount: need.amount, approx: true };

  // "2 onions" against a price per kg — needs to know what one onion weighs.
  if (need.family === 'count:each' && isMeasured(pack.family) && price.eachAmount) {
    return { amount: need.amount * price.eachAmount, approx: false };
  }

  // "400 g sausages" against a pack of 8 — same thing the other way round.
  if (isMeasured(need.family) && pack.family === 'count:each' && price.eachAmount) {
    return { amount: need.amount / price.eachAmount, approx: false };
  }

  return null;
}

// --- Finding a price ----------------------------------------------------------

const DEFAULT_INDEX = buildKeywordIndex(DEFAULT_PRICES);

// Turns rows from the `ingredient_prices` table into a lookup table.
// Row shape (snake_case, straight from Supabase) → price shape (camelCase,
// same as DEFAULT_PRICES) so the rest of this file only deals with one shape.
export function buildPriceTable(rows = []) {
  const overrides = {};
  (rows ?? []).forEach((row) => {
    overrides[row.ingredient_name] = {
      packSize: Number(row.pack_size),
      packUnit: row.pack_unit,
      packPrice: Number(row.pack_price),
      eachAmount: row.each_amount ? Number(row.each_amount) : undefined,
      pantry: !!row.is_pantry,
    };
  });
  return { overrides };
}

// Your own price for this exact ingredient name wins; otherwise the most
// specific default whose keyword appears in the name. Returns null when
// nothing matches at all.
export function findPrice(rawName, table = { overrides: {} }) {
  const name = (rawName || '').trim().toLowerCase();
  if (!name) return null;

  const own = table.overrides?.[name];
  if (own) return { price: own, source: 'yours', matchedOn: name };

  const hit = findKeyword(DEFAULT_INDEX, name);
  if (hit) return { price: hit, source: 'default', matchedOn: hit.keyword };

  return null;
}

// --- Costing ---------------------------------------------------------------------

const hasQuantity = (q) => q !== null && q !== undefined && q !== '' && !Number.isNaN(Number(q));

// Share-of-pack cost, for recipe costing. Status tells the UI why a cost is
// missing: 'no-price' (we don't know this ingredient), 'unit-mismatch' (e.g.
// "1 bulb" against a price per clove), or 'no-quantity' ("salt to taste").
export function usedCost(name, quantity, unit, table) {
  const found = findPrice(name, table);
  if (!found) return { status: 'no-price', cost: 0 };
  const { price } = found;
  const base = { source: found.source, pantry: !!price.pantry };

  if (!hasQuantity(quantity)) return { ...base, status: 'no-quantity', cost: 0 };

  const converted = convertToPackUnits(Number(quantity), unit, price);
  if (!converted) return { ...base, status: 'unit-mismatch', cost: 0 };

  const packAmount = toBase(price.packSize, price.packUnit).amount;
  return { ...base, status: 'priced', approx: converted.approx, cost: (converted.amount / packAmount) * price.packPrice };
}

// Whole-pack cost, for the shopping list. With no quantity at all ("onion",
// "salt") we assume you'll buy one pack, since you need *some*.
export function shopCost(name, quantity, unit, table) {
  const found = findPrice(name, table);
  if (!found) return { status: 'no-price', cost: 0, packs: 0 };
  const { price } = found;
  const base = { source: found.source, pantry: !!price.pantry, price };

  if (!hasQuantity(quantity)) return { ...base, status: 'priced', approx: true, packs: 1, cost: price.packPrice };

  const converted = convertToPackUnits(Number(quantity), unit, price);
  if (!converted) return { ...base, status: 'unit-mismatch', cost: 0, packs: 0 };

  const packAmount = toBase(price.packSize, price.packUnit).amount;
  // The small epsilon stops 1000 g / 1000 g = 1.0000000001 rounding up to 2 packs.
  const packs = Math.max(1, Math.ceil(converted.amount / packAmount - 1e-9));
  return { ...base, status: 'priced', approx: converted.approx, packs, cost: packs * price.packPrice };
}

// "£1.20 / 500 g" style label for a price entry.
export function describePrice(price) {
  return `${formatMoney(price.packPrice)} / ${trim(price.packSize)} ${price.packUnit}`;
}

export function formatMoney(amount) {
  return `£${(Number(amount) || 0).toFixed(2)}`;
}

function trim(n) {
  return Number(Number(n).toFixed(2)).toString();
}
