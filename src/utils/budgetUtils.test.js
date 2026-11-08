import { scaleFactor, buildWeekGroups, costItems, weekShopEstimate, recipeCost, mealCost } from './budgetUtils.js';
import { groupsToItems } from './shoppinglistutils.js';
import { buildPriceTable } from './priceUtils.js';

const table = buildPriceTable([
  { ingredient_name: 'rice', pack_size: 1000, pack_unit: 'g', pack_price: 2, each_amount: null, is_pantry: false },
  { ingredient_name: 'chicken', pack_size: 500, pack_unit: 'g', pack_price: 3, each_amount: null, is_pantry: false },
  { ingredient_name: 'salt', pack_size: 750, pack_unit: 'g', pack_price: 0.65, each_amount: null, is_pantry: true },
]);

const curry = {
  name: 'Curry',
  servings: 4,
  ingredients_structured: [
    { name: 'Rice', quantity: 400, unit: 'g' },
    { name: 'Chicken', quantity: 500, unit: 'g' },
    { name: 'Salt', quantity: 5, unit: 'g' },
  ],
};

describe('scaleFactor', () => {
  test('scales a recipe to the household', () => {
    expect(scaleFactor(4, 2)).toBe(0.5);
    expect(scaleFactor(2, 3)).toBe(1.5);
  });

  test('leaves the recipe alone when either number is missing', () => {
    expect(scaleFactor(null, 2)).toBe(1);
    expect(scaleFactor(4, '')).toBe(1);
    expect(scaleFactor(0, 2)).toBe(1);
  });
});

describe('buildWeekGroups', () => {
  const entries = [
    { plan_date: '2026-11-10', recipe: curry },
    { plan_date: '2026-11-09', recipe: null, custom_meal_name: 'Takeaway' },
  ];

  test('without scaling, quantities are as written', () => {
    const { groups, otherMeals } = buildWeekGroups(entries);
    expect(groups['rice|g'].totalQty).toBe(400);
    expect(otherMeals).toHaveLength(1);
  });

  test('with scaling, quantities follow household size', () => {
    const { groups } = buildWeekGroups(entries, { householdSize: 2, scale: true });
    expect(groups['rice|g'].totalQty).toBe(200);
    expect(groups['chicken|g'].totalQty).toBe(250);
  });

  test('ingredients without a quantity stay quantity-less when scaled', () => {
    const recipe = { servings: 2, ingredients_structured: [{ name: 'Onion', quantity: null, unit: null }] };
    const { groups } = buildWeekGroups([{ recipe }], { householdSize: 4, scale: true });
    expect(groups['onion|'].hasQty).toBe(false);
  });
});

describe('costItems', () => {
  test('totals whole packs, keeping pantry and unpriced items out of the total', () => {
    const { groups } = buildWeekGroups([{ recipe: curry }, { recipe: { ingredients_structured: [{ name: 'Unobtainium', quantity: 1, unit: 'g' }] } }]);
    const result = costItems(groupsToItems(groups), table);
    // rice 1 pack (£2) + chicken 1 pack (£3); salt is pantry
    expect(result.total).toBe(5);
    expect(result.pantryTotal).toBe(0.65);
    expect(result.unpriced).toBe(1);
  });
});

describe('costItems — same ingredient in different units', () => {
  test('adds lines together before rounding up to whole packs', () => {
    const tins = buildPriceTable([
      { ingredient_name: 'chopped tomatoes', pack_size: 400, pack_unit: 'g', pack_price: 0.45, each_amount: 400, is_pantry: false },
    ]);
    const groups = {};
    const recipes = [
      { ingredients_structured: [{ name: 'Chopped tomatoes', quantity: 200, unit: 'g' }] },
      { ingredients_structured: [{ name: 'chopped tomatoes', quantity: 0.5, unit: 'can' }] },
    ];
    Object.assign(groups, buildWeekGroups(recipes.map((recipe) => ({ recipe }))).groups);
    const items = groupsToItems(groups);
    expect(items).toHaveLength(2);

    const result = costItems(items, tins);
    expect(result.total).toBeCloseTo(0.45); // one tin, not two
    const lineCosts = items.map((i) => result.costs[i.key].cost);
    expect(lineCosts[0] + lineCosts[1]).toBeCloseTo(0.45);
  });
});

describe('weekShopEstimate', () => {
  test('scales then costs in one call', () => {
    // Household of 8 doubles the curry: 800 g rice (1 pack) + 1000 g chicken (2 packs)
    const result = weekShopEstimate([{ recipe: curry }], table, { householdSize: 8 });
    expect(result.total).toBe(2 + 6);
  });
});

describe('recipeCost / mealCost', () => {
  test('share-of-pack cost, with per serving', () => {
    const result = recipeCost(curry, table);
    // rice 0.4×£2 + chicken 1×£3 + salt (5/750)×£0.65
    expect(result.total).toBeCloseTo(0.8 + 3 + 0.00433, 4);
    expect(result.perServing).toBeCloseTo(result.total / 4, 6);
    expect(result.missing).toEqual([]);
  });

  test('lists ingredients it could not price', () => {
    const recipe = { servings: 1, ingredients_structured: [{ name: 'Unobtainium', quantity: 1, unit: 'g' }] };
    expect(recipeCost(recipe, table).missing).toEqual(['Unobtainium']);
  });

  test('mealCost scales to the household', () => {
    expect(mealCost(curry, table, 2)).toBeCloseTo(recipeCost(curry, table).total / 2, 6);
  });
});
