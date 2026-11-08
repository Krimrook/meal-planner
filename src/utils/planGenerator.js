// Auto-fills empty meal plan slots from your recipe library, keeping to your
// weekly budget and dietary preferences. Pure function — no Supabase, no
// React — and randomness is injectable, so planGenerator.test.js can make it
// deterministic.
//
// How it chooses, slot by slot:
//   1. Only recipes that fit the slot (a recipe's meal_types; none = any slot)
//      and your dietary preferences, and haven't hit the repeat limit.
//   2. Works out a fair share of the budget left for this slot
//      (money left ÷ slots left) and prefers recipes under that.
//   3. Among those, prefers the ones used least so far (variety), then picks
//      one at random — so "Regenerate" gives a different week.
//   4. If nothing is under the fair share, takes the cheapest that still fits
//      in what's left; if even that doesn't fit, leaves the slot empty and
//      says why, rather than blowing the budget.
//
// Costs here are share-of-pack (what the meals use), not whole-pack shop
// costs — the preview screen shows the real shop estimate separately.

import { mealCost } from './budgetUtils.js';

export function recipeSuitsSlot(recipe, slot) {
  const types = recipe.meal_types ?? [];
  return types.length === 0 || types.includes(slot);
}

export function recipeMatchesDiet(recipe, dietaryPreferences = []) {
  const tags = recipe.dietary_tags ?? [];
  return (dietaryPreferences ?? []).every((pref) => tags.includes(pref));
}

export function generatePlan({
  recipes = [],
  slots = [], // [{ dateISO, slot }] — the empty slots to fill, in order
  budget = null, // weekly budget in £; null/0 = no limit
  alreadySpent = 0, // cost of meals already in the plan this week
  existingRecipeIds = [], // recipes already planned this week (count toward repeats)
  householdSize = null,
  priceTable,
  dietaryPreferences = [],
  respectDiet = true,
  maxRepeats = 2,
  random = Math.random,
}) {
  const warnings = [];
  const proposals = [];
  const skipped = [];

  const candidates = recipes.filter((r) => !respectDiet || recipeMatchesDiet(r, dietaryPreferences));
  if (candidates.length === 0) {
    warnings.push(
      respectDiet && dietaryPreferences.length > 0
        ? `None of your recipes are tagged ${dietaryPreferences.join(' + ')}. Tag some recipes, or untick "Match my dietary preferences".`
        : 'Add some recipes to your library first.'
    );
    return { proposals, skipped: slots.map((s) => ({ ...s, reason: 'No recipes to choose from' })), total: 0, warnings };
  }

  const cost = {};
  candidates.forEach((r) => {
    cost[r.id] = mealCost(r, priceTable, householdSize);
  });

  const uses = {};
  existingRecipeIds.forEach((id) => {
    uses[id] = (uses[id] ?? 0) + 1;
  });

  const hasBudget = Number(budget) > 0;
  let remaining = hasBudget ? Number(budget) - alreadySpent : Infinity;
  let total = 0;
  const lastBySlot = {};

  slots.forEach((target, i) => {
    const pool = candidates.filter((r) => recipeSuitsSlot(r, target.slot) && (uses[r.id] ?? 0) < maxRepeats);
    if (pool.length === 0) {
      skipped.push({ ...target, reason: `No more ${target.slot} recipes (each can repeat ${maxRepeats}× a week)` });
      return;
    }

    const fairShare = remaining / (slots.length - i);
    const affordable = pool.filter((r) => cost[r.id] <= fairShare);

    let choice = null;
    if (affordable.length > 0) {
      const fewestUses = Math.min(...affordable.map((r) => uses[r.id] ?? 0));
      let freshest = affordable.filter((r) => (uses[r.id] ?? 0) === fewestUses);
      // Avoid the same recipe two days running in the same slot when there's
      // any alternative (e.g. salmon on Wednesday *and* Thursday dinner).
      const yesterday = lastBySlot[target.slot];
      if (freshest.length > 1 && yesterday) freshest = freshest.filter((r) => r.id !== yesterday);
      choice = freshest[Math.floor(random() * freshest.length) % freshest.length];
    } else {
      const cheapest = [...pool].sort((a, b) => cost[a.id] - cost[b.id])[0];
      if (cost[cheapest.id] <= remaining) choice = cheapest;
    }

    if (!choice) {
      skipped.push({ ...target, reason: 'Would go over budget' });
      return;
    }

    uses[choice.id] = (uses[choice.id] ?? 0) + 1;
    remaining -= cost[choice.id];
    total += cost[choice.id];
    lastBySlot[target.slot] = choice.id;
    proposals.push({ ...target, recipe: choice, cost: cost[choice.id] });
  });

  if (hasBudget && skipped.some((s) => s.reason === 'Would go over budget')) {
    warnings.push('Some slots were left empty to stay within your weekly budget.');
  }

  return { proposals, skipped, total, warnings };
}
