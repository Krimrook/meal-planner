import { generatePlan, recipeSuitsSlot, recipeMatchesDiet } from './planGenerator.js';
import { buildPriceTable } from './priceUtils.js';

// One override per test recipe so each meal has a simple, known cost:
// a recipe with 1 "kg" of "x-<name>" costs exactly its pack price.
function recipe(id, price, extra = {}) {
  return {
    id,
    name: id,
    servings: 1,
    meal_types: [],
    dietary_tags: [],
    ingredients_structured: [{ name: `x-${id}`, quantity: 1, unit: 'kg' }],
    __price: price,
    ...extra,
  };
}

function tableFor(recipes) {
  return buildPriceTable(
    recipes.map((r) => ({
      ingredient_name: `x-${r.id}`,
      pack_size: 1,
      pack_unit: 'kg',
      pack_price: r.__price,
      each_amount: null,
      is_pantry: false,
    }))
  );
}

const slots = (n, slot = 'dinner') =>
  Array.from({ length: n }, (_, i) => ({ dateISO: `2026-11-${String(9 + i).padStart(2, '0')}`, slot }));

const firstPick = () => 0;

describe('filters', () => {
  test('a recipe with no meal types suits any slot', () => {
    expect(recipeSuitsSlot({ meal_types: [] }, 'breakfast')).toBe(true);
    expect(recipeSuitsSlot({ meal_types: ['dinner'] }, 'breakfast')).toBe(false);
  });

  test('a recipe must carry every dietary preference', () => {
    expect(recipeMatchesDiet({ dietary_tags: ['Vegan', 'Gluten-Free'] }, ['Vegan'])).toBe(true);
    expect(recipeMatchesDiet({ dietary_tags: ['Vegetarian'] }, ['Vegan'])).toBe(false);
    expect(recipeMatchesDiet({ dietary_tags: [] }, [])).toBe(true);
  });
});

describe('generatePlan', () => {
  test('fills every slot when the budget allows, and totals the cost', () => {
    const recipes = [recipe('a', 3), recipe('b', 4), recipe('c', 5)];
    const result = generatePlan({ recipes, slots: slots(3), budget: 50, priceTable: tableFor(recipes), random: firstPick });
    expect(result.proposals).toHaveLength(3);
    expect(result.skipped).toHaveLength(0);
    expect(result.total).toBeCloseTo(result.proposals.reduce((s, p) => s + p.cost, 0));
  });

  test('never repeats a recipe more than maxRepeats times', () => {
    const recipes = [recipe('a', 1)];
    const result = generatePlan({ recipes, slots: slots(4), priceTable: tableFor(recipes), maxRepeats: 2 });
    expect(result.proposals).toHaveLength(2);
    expect(result.skipped).toHaveLength(2);
  });

  test('prefers variety: uses every recipe once before repeating', () => {
    const recipes = [recipe('a', 1), recipe('b', 1), recipe('c', 1)];
    const result = generatePlan({ recipes, slots: slots(3), priceTable: tableFor(recipes), random: firstPick });
    expect(new Set(result.proposals.map((p) => p.recipe.id)).size).toBe(3);
  });

  test('avoids the same recipe two days running in a slot when there is a choice', () => {
    const recipes = [recipe('a', 1), recipe('b', 1)];
    // Always picking the first candidate would give a, a, b, b without the rule
    const result = generatePlan({ recipes, slots: slots(4), priceTable: tableFor(recipes), random: firstPick });
    const ids = result.proposals.map((p) => p.recipe.id);
    ids.slice(1).forEach((id, i) => expect(id).not.toBe(ids[i]));
  });

  test('counts recipes already planned this week toward the repeat limit', () => {
    const recipes = [recipe('a', 1), recipe('b', 1)];
    const result = generatePlan({
      recipes,
      slots: slots(1),
      existingRecipeIds: ['a', 'a'],
      priceTable: tableFor(recipes),
    });
    expect(result.proposals[0].recipe.id).toBe('b');
  });

  test('leaves slots empty rather than going over budget', () => {
    const recipes = [recipe('pricey', 10)];
    const result = generatePlan({ recipes, slots: slots(2), budget: 15, priceTable: tableFor(recipes) });
    expect(result.proposals).toHaveLength(1);
    expect(result.skipped[0].reason).toBe('Would go over budget');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('takes money already spent this week into account', () => {
    const recipes = [recipe('a', 5)];
    const result = generatePlan({ recipes, slots: slots(1), budget: 10, alreadySpent: 8, priceTable: tableFor(recipes) });
    expect(result.proposals).toHaveLength(0);
  });

  test('picks cheaper recipes when the budget is tight', () => {
    const recipes = [recipe('cheap', 2), recipe('dear', 9)];
    const result = generatePlan({ recipes, slots: slots(2), budget: 6, priceTable: tableFor(recipes), maxRepeats: 2 });
    expect(result.proposals.map((p) => p.recipe.id)).toEqual(['cheap', 'cheap']);
  });

  test('respects meal types per slot', () => {
    const recipes = [recipe('porridge', 1, { meal_types: ['breakfast'] }), recipe('stew', 1, { meal_types: ['dinner'] })];
    const result = generatePlan({
      recipes,
      slots: [
        { dateISO: '2026-11-09', slot: 'breakfast' },
        { dateISO: '2026-11-09', slot: 'dinner' },
      ],
      priceTable: tableFor(recipes),
    });
    expect(result.proposals.map((p) => p.recipe.id)).toEqual(['porridge', 'stew']);
  });

  test('explains when no recipe matches the dietary preferences', () => {
    const recipes = [recipe('a', 1, { dietary_tags: ['Vegetarian'] })];
    const result = generatePlan({ recipes, slots: slots(1), dietaryPreferences: ['Vegan'], priceTable: tableFor(recipes) });
    expect(result.proposals).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/Vegan/);

    const relaxed = generatePlan({
      recipes,
      slots: slots(1),
      dietaryPreferences: ['Vegan'],
      respectDiet: false,
      priceTable: tableFor(recipes),
    });
    expect(relaxed.proposals).toHaveLength(1);
  });

  test('scales meal cost to the household', () => {
    const recipes = [recipe('a', 4, { servings: 2 })];
    const result = generatePlan({ recipes, slots: slots(1), householdSize: 4, priceTable: tableFor(recipes) });
    expect(result.proposals[0].cost).toBeCloseTo(8);
  });
});
