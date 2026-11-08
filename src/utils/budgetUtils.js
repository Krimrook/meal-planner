// Budget-level helpers built on top of priceUtils.js: scaling recipes to your
// household, turning a week of meal plan entries into a costed shopping list,
// and costing a single recipe. Pure functions only, so they're unit tested in
// budgetUtils.test.js and shared by the Shopping List, Meal Plan and Welcome
// screens rather than each doing its own sums.

import { addToGroups, groupsToItems } from './shoppinglistutils.js';
import { usedCost, shopCost, toBase, convertToPackUnits } from './priceUtils.js';

// How much to multiply a recipe's quantities by so it feeds the household.
// A recipe that serves 4, cooked for a household of 2 → 0.5. If either number
// is missing we can't scale sensibly, so leave the recipe as written.
export function scaleFactor(recipeServings, householdSize) {
  const servings = Number(recipeServings);
  const people = Number(householdSize);
  if (!servings || !people || servings <= 0 || people <= 0) return 1;
  return people / servings;
}

// Folds a week of meal_plan_entries rows (each with an optional joined
// `recipe`) into shopping list groups. Entries with no recipe ingredients but
// a custom note come back separately as `otherMeals`, same as before Day 10.
export function buildWeekGroups(entries, { householdSize = null, scale = false } = {}) {
  const groups = {};
  const otherMeals = [];

  (entries ?? []).forEach((entry) => {
    const recipe = entry.recipe;
    const structured = recipe?.ingredients_structured;

    if (structured?.length > 0) {
      const factor = scale ? scaleFactor(recipe.servings, householdSize) : 1;
      structured.forEach((ing) => {
        const hasQty = ing.quantity !== null && ing.quantity !== undefined && ing.quantity !== '';
        addToGroups(groups, ing.name, ing.unit, hasQty ? Number(ing.quantity) * factor : ing.quantity);
      });
    } else if (entry.custom_meal_name) {
      otherMeals.push(entry);
    }
  });

  otherMeals.sort((a, b) => a.plan_date.localeCompare(b.plan_date));
  return { groups, otherMeals };
}

// Costs every shopping list item (whole packs) and totals the week.
// Pantry staples are costed but kept out of `total`, since you're not
// rebuying salt every week; `unpriced` counts items with no usable price.
//
// The same ingredient can appear on several lines when recipes use different
// units ("200 g chopped tomatoes" and "0.5 can chopped tomatoes"). Those are
// added together *before* rounding up to whole packs — otherwise that example
// would buy two tins when one is enough. Each line's displayed cost is then
// its share of the combined cost, so the lines still add up to the total.
export function costItems(items, priceTable) {
  const costs = {};
  let total = 0;
  let pantryTotal = 0;
  let unpriced = 0;
  let approx = false;

  const byName = {};
  items.forEach((item) => {
    const name = item.name.toLowerCase();
    if (!byName[name]) byName[name] = [];
    byName[name].push(item);
  });

  Object.values(byName).forEach((lines) => {
    const results = lines.map((item) => ({ item, result: shopCost(item.name, item.quantity, item.unit, priceTable) }));
    const priced = results.filter((r) => r.result.status === 'priced');

    results
      .filter((r) => r.result.status !== 'priced')
      .forEach(({ item, result }) => {
        costs[item.key] = result;
        unpriced += 1;
      });
    if (priced.length === 0) return;

    // Combine the lines' amounts in pack units, then round up once.
    const { price } = priced[0].result;
    const packAmount = toBase(price.packSize, price.packUnit).amount;
    const amounts = priced.map(({ item, result }) => {
      if (item.quantity === null || item.quantity === undefined) return packAmount; // "one pack"
      return convertToPackUnits(Number(item.quantity), item.unit, price)?.amount ?? 0;
    });
    const combined = amounts.reduce((a, b) => a + b, 0);
    const packs = Math.max(1, Math.ceil(combined / packAmount - 1e-9));
    const lineTotal = packs * price.packPrice;
    const isApprox = priced.some(({ result }) => result.approx);

    priced.forEach(({ item, result }, i) => {
      const share = combined > 0 ? amounts[i] / combined : 1 / priced.length;
      costs[item.key] = { ...result, packs, cost: lineTotal * share, combinedLines: priced.length };
    });

    if (priced[0].result.pantry) {
      pantryTotal += lineTotal;
    } else {
      total += lineTotal;
      if (isApprox) approx = true;
    }
  });

  return { costs, total, pantryTotal, unpriced, approx };
}

// One call for "what will this week's shop cost?" — used by the Welcome
// dashboard and the Meal Plan's weekly estimate.
export function weekShopEstimate(entries, priceTable, { householdSize = null, scale = true } = {}) {
  const { groups } = buildWeekGroups(entries, { householdSize, scale });
  return costItems(groupsToItems(groups), priceTable);
}

// Share-of-pack cost of one recipe as written, plus per serving.
// `missing` lists ingredient names we couldn't price, so the UI can say
// "excludes 2 ingredients" instead of quietly under-reporting.
export function recipeCost(recipe, priceTable) {
  let total = 0;
  const missing = [];

  (recipe?.ingredients_structured ?? []).forEach((ing) => {
    const result = usedCost(ing.name, ing.quantity, ing.unit, priceTable);
    if (result.status === 'priced') total += result.cost;
    else if (result.status !== 'no-quantity') missing.push(ing.name);
  });

  const servings = Number(recipe?.servings) || null;
  return { total, perServing: servings ? total / servings : null, missing };
}

// Cost of cooking a recipe once for the household (scaled), share-of-pack.
export function mealCost(recipe, priceTable, householdSize) {
  const { total } = recipeCost(recipe, priceTable);
  return total * scaleFactor(recipe?.servings, householdSize);
}
