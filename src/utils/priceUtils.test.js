import {
  normalizeUnit,
  toBase,
  convertToPackUnits,
  buildPriceTable,
  findPrice,
  usedCost,
  shopCost,
  describePrice,
  formatMoney,
} from './priceUtils.js';

const emptyTable = buildPriceTable([]);

describe('normalizeUnit', () => {
  test('maps common spellings to one canonical unit', () => {
    expect(normalizeUnit('Grams')).toBe('g');
    expect(normalizeUnit(' kg ')).toBe('kg');
    expect(normalizeUnit('Tablespoons')).toBe('tbsp');
    expect(normalizeUnit('litre')).toBe('l');
  });

  test('blank, "can" and "slice" all mean one item', () => {
    expect(normalizeUnit('')).toBe('each');
    expect(normalizeUnit(null)).toBe('each');
    expect(normalizeUnit('can')).toBe('each');
    expect(normalizeUnit('slices')).toBe('each');
  });

  test('unknown units are lowercased and de-pluralised', () => {
    expect(normalizeUnit('Cloves')).toBe('clove');
    expect(normalizeUnit('bunch')).toBe('bunch');
  });
});

describe('toBase', () => {
  test('converts mass and volume into grams and millilitres', () => {
    expect(toBase(1.5, 'kg')).toEqual({ family: 'mass', amount: 1500 });
    expect(toBase(2, 'tbsp')).toEqual({ family: 'volume', amount: 30 });
  });

  test('count units get their own family', () => {
    expect(toBase(3, 'cloves')).toEqual({ family: 'count:clove', amount: 3 });
    expect(toBase(2, '')).toEqual({ family: 'count:each', amount: 2 });
  });
});

describe('convertToPackUnits', () => {
  const perKg = { packSize: 1, packUnit: 'kg', packPrice: 1, eachAmount: 150 };

  test('same family converts directly', () => {
    expect(convertToPackUnits(500, 'g', perKg)).toEqual({ amount: 500, approx: false });
  });

  test('counted items use eachAmount against a weighed pack', () => {
    expect(convertToPackUnits(2, '', perKg)).toEqual({ amount: 300, approx: false });
  });

  test('weight against a counted pack uses eachAmount the other way', () => {
    const sausages = { packSize: 8, packUnit: 'each', packPrice: 2, eachAmount: 50 };
    expect(convertToPackUnits(400, 'g', sausages)).toEqual({ amount: 8, approx: false });
  });

  test('weight vs volume assumes 1 g = 1 ml and flags it as approximate', () => {
    const milk = { packSize: 1, packUnit: 'l', packPrice: 1 };
    expect(convertToPackUnits(200, 'g', milk)).toEqual({ amount: 200, approx: true });
  });

  test('returns null when there is no way to compare', () => {
    const garlic = { packSize: 40, packUnit: 'clove', packPrice: 0.85 };
    expect(convertToPackUnits(1, 'bulb', garlic)).toBeNull();
    expect(convertToPackUnits(2, '', { packSize: 1, packUnit: 'kg', packPrice: 1 })).toBeNull();
  });
});

describe('findPrice', () => {
  test('falls back to the most specific default keyword', () => {
    expect(findPrice('Chicken Breasts', emptyTable)).toMatchObject({ source: 'default', matchedOn: 'chicken breast' });
    expect(findPrice('coconut milk', emptyTable).matchedOn).toBe('coconut milk');
    expect(findPrice('chicken stock', emptyTable).matchedOn).toBe('chicken stock');
  });

  test('your own price for the exact name beats the default', () => {
    const table = buildPriceTable([
      { ingredient_name: 'chicken breast', pack_size: 1, pack_unit: 'kg', pack_price: '6.00', each_amount: null, is_pantry: false },
    ]);
    const found = findPrice('Chicken Breast', table);
    expect(found.source).toBe('yours');
    expect(found.price).toMatchObject({ packSize: 1, packUnit: 'kg', packPrice: 6 });
  });

  test('returns null for blank or unknown ingredients', () => {
    expect(findPrice('', emptyTable)).toBeNull();
    expect(findPrice('dragonfruit essence', emptyTable)).toBeNull();
  });
});

describe('usedCost', () => {
  const table = buildPriceTable([
    { ingredient_name: 'rice', pack_size: 1000, pack_unit: 'g', pack_price: 2, each_amount: null, is_pantry: false },
  ]);

  test('charges the share of the pack actually used', () => {
    expect(usedCost('rice', 250, 'g', table)).toMatchObject({ status: 'priced', cost: 0.5 });
  });

  test('explains why it could not cost something', () => {
    expect(usedCost('rice', null, 'g', table).status).toBe('no-quantity');
    expect(usedCost('mystery', 1, 'g', table).status).toBe('no-price');
    expect(usedCost('garlic', 1, 'bulb', table).status).toBe('unit-mismatch');
  });
});

describe('shopCost', () => {
  const table = buildPriceTable([
    { ingredient_name: 'rice', pack_size: 1000, pack_unit: 'g', pack_price: 2, each_amount: null, is_pantry: false },
    { ingredient_name: 'salt', pack_size: 750, pack_unit: 'g', pack_price: 0.65, each_amount: null, is_pantry: true },
  ]);

  test('rounds up to whole packs', () => {
    expect(shopCost('rice', 1200, 'g', table)).toMatchObject({ packs: 2, cost: 4 });
  });

  test('an exact pack does not round up to two', () => {
    expect(shopCost('rice', 1, 'kg', table)).toMatchObject({ packs: 1, cost: 2 });
  });

  test('no quantity means buy one pack, flagged as approximate', () => {
    expect(shopCost('rice', null, '', table)).toMatchObject({ packs: 1, cost: 2, approx: true });
  });

  test('marks pantry staples', () => {
    expect(shopCost('salt', 5, 'g', table).pantry).toBe(true);
  });
});

describe('formatting', () => {
  test('formatMoney always shows pence', () => {
    expect(formatMoney(3)).toBe('£3.00');
    expect(formatMoney(0.456)).toBe('£0.46');
  });

  test('describePrice', () => {
    expect(describePrice({ packPrice: 1.2, packSize: 500, packUnit: 'g' })).toBe('£1.20 / 500 g');
  });
});
