import { trimNumber, addToGroups, groupsToItems, guessAisle, groupsToSections } from './shoppinglistutils.js';
import { AISLES, AISLE_KEYWORDS } from './constants.js';

describe('trimNumber', () => {
  test('strips floating point addition artifacts', () => {
    // 0.1 + 0.2 famously comes out as 0.30000000000000004 in JS
    expect(trimNumber(0.1 + 0.2)).toBe('0.3');
  });

  test('keeps whole numbers whole (no trailing .00)', () => {
    expect(trimNumber(400)).toBe('400');
  });

  test('rounds to 2 decimal places', () => {
    expect(trimNumber(1.005)).toBe('1'); // 1.005 itself is not exactly representable
    expect(trimNumber(1.239)).toBe('1.24');
  });
});

describe('addToGroups', () => {
  test('groups the same name+unit case-insensitively and sums quantities', () => {
    const groups = {};
    addToGroups(groups, 'Chicken Breast', 'g', 200);
    addToGroups(groups, 'chicken breast', 'G', 150);

    const key = Object.keys(groups);
    expect(key).toHaveLength(1);
    expect(groups[key[0]]).toMatchObject({ name: 'Chicken Breast', totalQty: 350, hasQty: true, count: 2 });
  });

  test('keeps different units as separate groups for the same ingredient name', () => {
    const groups = {};
    addToGroups(groups, 'Milk', 'ml', 200);
    addToGroups(groups, 'Milk', 'l', 1);

    expect(Object.keys(groups)).toHaveLength(2);
  });

  test('ingredients without a quantity still get grouped, just without a total', () => {
    const groups = {};
    addToGroups(groups, 'Onion', null, null);
    addToGroups(groups, 'onion', '', '');

    const key = Object.keys(groups);
    expect(key).toHaveLength(1);
    expect(groups[key[0]]).toMatchObject({ hasQty: false, count: 2 });
  });

  test('ignores an entry with a blank name', () => {
    const groups = {};
    addToGroups(groups, '   ', 'g', 100);
    expect(Object.keys(groups)).toHaveLength(0);
  });
});

describe('groupsToItems', () => {
  test('sorts alphabetically by name', () => {
    const groups = {};
    addToGroups(groups, 'Rice', 'g', 200);
    addToGroups(groups, 'Chicken', 'g', 300);

    const items = groupsToItems(groups);
    expect(items.map((i) => i.name ?? i.label)).toEqual(
      expect.arrayContaining([expect.stringContaining('Chicken'), expect.stringContaining('Rice')])
    );
    // Chicken should come before Rice
    const chickenIndex = items.findIndex((i) => i.label.includes('Chicken'));
    const riceIndex = items.findIndex((i) => i.label.includes('Rice'));
    expect(chickenIndex).toBeLessThan(riceIndex);
  });

  test('formats a quantified item as "<total> <unit> <name>"', () => {
    const groups = {};
    addToGroups(groups, 'Chicken Breast', 'g', 200);
    addToGroups(groups, 'Chicken Breast', 'g', 200);

    const [item] = groupsToItems(groups);
    expect(item.label).toBe('400 g Chicken Breast');
    expect(item.showCount).toBe(false);
  });

  test('falls back to a bare name with showCount when there is no quantity', () => {
    const groups = {};
    addToGroups(groups, 'Salt', null, null);
    addToGroups(groups, 'salt', null, null);

    const [item] = groupsToItems(groups);
    expect(item.label).toBe('Salt');
    expect(item.count).toBe(2);
    expect(item.showCount).toBe(true);
  });

  test('does not show a count for a single unquantified occurrence', () => {
    const groups = {};
    addToGroups(groups, 'Salt', null, null);

    const [item] = groupsToItems(groups);
    expect(item.showCount).toBe(false);
  });
});

describe('guessAisle', () => {
  test('places common ingredients in the expected aisle', () => {
    expect(guessAisle('Chicken Breast')).toBe('Meat & Fish');
    expect(guessAisle('Cheddar')).toBe('Dairy & Eggs');
    expect(guessAisle('Basmati rice')).toBe('Pasta, Rice & Grains');
    expect(guessAisle('Paprika')).toBe('Herbs & Spices');
  });

  test('matches plurals of a singular keyword', () => {
    expect(guessAisle('Eggs')).toBe('Dairy & Eggs');
    expect(guessAisle('Tomatoes')).toBe('Fruit & Veg');
  });

  test('the longest matching keyword wins over a shorter one', () => {
    expect(guessAisle('Coconut milk')).toBe('Tins & Jars'); // not Dairy & Eggs
    expect(guessAisle('Chicken stock')).toBe('Cooking & Baking'); // not Meat & Fish
    expect(guessAisle('Peanut butter')).toBe('Tins & Jars'); // not Dairy & Eggs
    expect(guessAisle('Chopped tomatoes')).toBe('Tins & Jars'); // not Fruit & Veg
    expect(guessAisle('Olive oil')).toBe('Cooking & Baking'); // not Tins & Jars
  });

  test('a qualifier word decides the aisle regardless of the ingredient', () => {
    expect(guessAisle('Frozen sweetcorn')).toBe('Frozen');
    expect(guessAisle('Tinned peaches')).toBe('Tins & Jars');
  });

  test('only matches whole words, not fragments inside another word', () => {
    // "pea" is a Fruit & Veg keyword but must not match inside "peanut"
    expect(guessAisle('Peanuts')).toBe('Other');
  });

  test('falls back to Other for unknown, blank or missing names', () => {
    expect(guessAisle('Dragon scales')).toBe('Other');
    expect(guessAisle('')).toBe('Other');
    expect(guessAisle(null)).toBe('Other');
  });

  test('every keyword list belongs to a real aisle', () => {
    Object.keys(AISLE_KEYWORDS).forEach((aisle) => expect(AISLES).toContain(aisle));
  });
});

describe('groupsToSections', () => {
  test('returns sections in AISLES order, skipping empty aisles', () => {
    const groups = {};
    addToGroups(groups, 'Dragon scales', null, null);
    addToGroups(groups, 'Milk', 'ml', 500);
    addToGroups(groups, 'Onion', null, 2);

    const sections = groupsToSections(groups);
    expect(sections.map((s) => s.aisle)).toEqual(['Fruit & Veg', 'Dairy & Eggs', 'Other']);
  });

  test('keeps items alphabetical within an aisle', () => {
    const groups = {};
    addToGroups(groups, 'Onion', null, 1);
    addToGroups(groups, 'Carrot', null, 3);

    const [section] = groupsToSections(groups);
    expect(section.items.map((i) => i.name)).toEqual(['Carrot', 'Onion']);
  });

  test('items keep the same key and label as groupsToItems, so ticked state still matches', () => {
    const groups = {};
    addToGroups(groups, 'Chicken Breast', 'g', 200);
    addToGroups(groups, 'chicken breast', 'g', 200);

    const [section] = groupsToSections(groups);
    expect(section.items[0]).toMatchObject({
      key: 'chicken breast|g',
      label: '400 g Chicken Breast',
      aisle: 'Meat & Fish',
    });
  });

  test('an override beats the guess, matched case-insensitively on name', () => {
    const groups = {};
    addToGroups(groups, 'Tofu', 'g', 400);

    expect(groupsToSections(groups)[0].aisle).toBe('Other');
    expect(groupsToSections(groups, { tofu: 'Dairy & Eggs' })[0].aisle).toBe('Dairy & Eggs');
  });

  test('ignores an override that names an aisle which does not exist', () => {
    const groups = {};
    addToGroups(groups, 'Milk', 'ml', 500);

    expect(groupsToSections(groups, { milk: 'Aisle 47' })[0].aisle).toBe('Dairy & Eggs');
  });

  test('returns an empty array when there is nothing to buy', () => {
    expect(groupsToSections({})).toEqual([]);
  });
});