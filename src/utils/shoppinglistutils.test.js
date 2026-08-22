import { trimNumber, addToGroups, groupsToItems } from './shoppinglistutils.js';

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