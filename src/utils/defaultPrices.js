// Starter price list used when you haven't entered your own price for an
// ingredient. These are rough, standard-range UK supermarket prices — Claude's
// estimates as of Nov 2026, NOT live data from any shop. They're meant to get
// the budget numbers into the right ballpark on day one; correct anything
// that's off on the Prices screen and your price wins from then on.
//
// Each entry:
//   keyword    — matched against ingredient names the same way aisles are
//                (whole word, optional plural, longest keyword wins)
//   packSize   — how much is in the pack you'd actually buy
//   packUnit   — 'g', 'ml', 'each', or a count unit like 'clove'
//   packPrice  — £ for one pack
//   eachAmount — optional: grams (or ml) in ONE item, so "2 onions" can be
//                costed against a price per kg, and "400 g sausages" against
//                a pack of 8
//   pantry     — optional: a cupboard staple you don't rebuy every week.
//                Still costed per recipe, but left out of the weekly shop total.

export const PRICE_DATA_LABEL = 'Approximate UK prices (Claude’s Nov 2026 estimates) — edit any that are wrong';

const p = (keyword, packSize, packUnit, packPrice, extra = {}) => ({ keyword, packSize, packUnit, packPrice, ...extra });

export const DEFAULT_PRICES = [
  // Fruit & Veg
  p('onion', 1000, 'g', 0.95, { eachAmount: 150 }),
  p('red onion', 1000, 'g', 1.15, { eachAmount: 150 }),
  p('spring onion', 100, 'g', 0.55, { eachAmount: 15 }),
  p('shallot', 400, 'g', 1.1, { eachAmount: 40 }),
  p('garlic', 40, 'clove', 0.85),
  p('potato', 2500, 'g', 1.5, { eachAmount: 200 }),
  p('sweet potato', 1000, 'g', 1.25, { eachAmount: 250 }),
  p('carrot', 1000, 'g', 0.6, { eachAmount: 80 }),
  p('parsnip', 500, 'g', 0.75, { eachAmount: 120 }),
  p('tomato', 6, 'each', 0.95, { eachAmount: 90 }),
  p('cherry tomato', 250, 'g', 0.95),
  p('pepper', 3, 'each', 1.6, { eachAmount: 160 }),
  p('chilli', 50, 'g', 0.65, { eachAmount: 10 }),
  p('mushroom', 300, 'g', 1.0),
  p('courgette', 500, 'g', 1.0, { eachAmount: 250 }),
  p('aubergine', 1, 'each', 0.8, { eachAmount: 300 }),
  p('broccoli', 360, 'g', 0.7, { eachAmount: 360 }),
  p('cauliflower', 600, 'g', 1.05, { eachAmount: 600 }),
  p('cabbage', 1, 'each', 0.7, { eachAmount: 900 }),
  p('spinach', 240, 'g', 1.35),
  p('kale', 200, 'g', 1.0),
  p('lettuce', 1, 'each', 0.65),
  p('salad', 120, 'g', 0.95),
  p('rocket', 60, 'g', 0.95),
  p('cucumber', 1, 'each', 0.75),
  p('celery', 1, 'each', 0.7),
  p('leek', 500, 'g', 1.0, { eachAmount: 200 }),
  p('ginger', 100, 'g', 0.6),
  p('pea', 900, 'g', 1.3),
  p('green bean', 220, 'g', 1.0),
  p('sweetcorn', 325, 'g', 0.6, { eachAmount: 325 }),
  p('butternut squash', 1, 'each', 1.1, { eachAmount: 1000 }),
  p('avocado', 1, 'each', 0.75),
  p('lemon', 4, 'each', 1.1),
  p('lime', 4, 'each', 1.1),
  p('orange', 6, 'each', 1.6),
  p('apple', 6, 'each', 1.25, { eachAmount: 150 }),
  p('banana', 5, 'each', 0.85, { eachAmount: 120 }),
  p('blueberry', 150, 'g', 1.6),
  p('strawberry', 400, 'g', 2.0),
  p('berries', 500, 'g', 2.25),
  p('coriander', 30, 'g', 0.7),
  p('parsley', 30, 'g', 0.7),
  p('basil', 30, 'g', 0.8),
  p('mint', 30, 'g', 0.7),

  // Meat & Fish
  p('chicken', 1000, 'g', 5.5),
  p('chicken breast', 650, 'g', 3.85, { eachAmount: 160 }),
  p('chicken thigh', 1000, 'g', 3.5, { eachAmount: 120 }),
  p('mince', 500, 'g', 2.85),
  p('beef mince', 500, 'g', 2.85),
  p('pork mince', 500, 'g', 2.5),
  p('turkey mince', 500, 'g', 3.0),
  p('lamb mince', 500, 'g', 4.0),
  p('beef', 400, 'g', 3.8),
  p('steak', 225, 'g', 3.5, { eachAmount: 225 }),
  p('pork', 500, 'g', 3.0),
  p('lamb', 500, 'g', 5.0),
  p('sausage', 8, 'each', 1.85, { eachAmount: 57 }),
  p('bacon', 300, 'g', 2.0, { eachAmount: 25 }),
  p('ham', 125, 'g', 1.25, { eachAmount: 25 }),
  p('chorizo', 225, 'g', 2.0),
  p('salmon', 240, 'g', 3.5, { eachAmount: 120 }),
  p('cod', 280, 'g', 3.75, { eachAmount: 140 }),
  p('fish', 280, 'g', 3.0, { eachAmount: 140 }),
  p('prawn', 150, 'g', 2.25),
  p('tuna', 145, 'g', 1.0, { eachAmount: 145 }),

  // Dairy & Eggs
  p('milk', 2272, 'ml', 1.55),
  p('butter', 250, 'g', 2.15),
  p('cheese', 400, 'g', 3.0, { eachAmount: 20 }),
  p('cheddar', 400, 'g', 3.0, { eachAmount: 20 }),
  p('mozzarella', 125, 'g', 0.75, { eachAmount: 125 }),
  p('parmesan', 180, 'g', 2.25),
  p('feta', 200, 'g', 1.4),
  p('halloumi', 225, 'g', 2.25),
  p('cream cheese', 180, 'g', 0.9),
  p('yoghurt', 500, 'g', 0.85),
  p('yogurt', 500, 'g', 0.85),
  p('greek yoghurt', 500, 'g', 1.2),
  p('cream', 300, 'ml', 1.1),
  p('double cream', 300, 'ml', 1.25),
  p('creme fraiche', 300, 'ml', 1.05),
  p('egg', 6, 'each', 1.45, { eachAmount: 55 }),

  // Bakery
  p('bread', 800, 'g', 0.75, { eachAmount: 40 }),
  p('wrap', 8, 'each', 1.1),
  p('tortilla', 8, 'each', 1.1),
  p('pitta', 6, 'each', 0.65),
  p('naan', 2, 'each', 1.0),
  p('roll', 6, 'each', 0.75),
  p('bun', 6, 'each', 0.75),
  p('bagel', 5, 'each', 1.1),

  // Pasta, Rice & Grains
  p('pasta', 1000, 'g', 0.9),
  p('spaghetti', 1000, 'g', 0.9),
  p('penne', 1000, 'g', 0.9),
  p('fusilli', 1000, 'g', 0.9),
  p('lasagne', 500, 'g', 0.85),
  p('noodle', 300, 'g', 1.0),
  p('egg noodle', 250, 'g', 0.9),
  p('rice', 1000, 'g', 1.15),
  p('basmati rice', 1000, 'g', 1.85),
  p('couscous', 500, 'g', 0.85),
  p('quinoa', 300, 'g', 1.75),
  p('oat', 1000, 'g', 0.95),
  p('lentil', 500, 'g', 1.05),
  p('granola', 500, 'g', 1.75),
  p('cereal', 500, 'g', 1.5),

  // Tins & Jars
  p('chopped tomato', 400, 'g', 0.45, { eachAmount: 400 }),
  p('plum tomato', 400, 'g', 0.45, { eachAmount: 400 }),
  p('passata', 500, 'g', 0.55),
  p('tomato puree', 142, 'g', 0.45, { pantry: true }),
  p('baked bean', 415, 'g', 0.4, { eachAmount: 415 }),
  p('kidney bean', 400, 'g', 0.4, { eachAmount: 400 }),
  p('black bean', 400, 'g', 0.55, { eachAmount: 400 }),
  p('butter bean', 400, 'g', 0.45, { eachAmount: 400 }),
  p('chickpea', 400, 'g', 0.45, { eachAmount: 400 }),
  p('coconut milk', 400, 'ml', 0.95, { eachAmount: 400 }),
  p('soup', 400, 'g', 0.85, { eachAmount: 400 }),
  p('olive', 160, 'g', 1.0),
  p('pesto', 190, 'g', 1.25),
  p('curry paste', 190, 'g', 1.3),
  p('peanut butter', 340, 'g', 1.5, { pantry: true }),
  p('jam', 454, 'g', 1.0, { pantry: true }),
  p('honey', 340, 'g', 1.5, { pantry: true }),

  // Herbs & Spices — all pantry
  ...[
    'paprika', 'smoked paprika', 'cumin', 'turmeric', 'chilli powder', 'chilli flake', 'curry powder',
    'garam masala', 'ground coriander', 'cinnamon', 'nutmeg', 'oregano', 'mixed herb', 'bay leaf',
    'garlic powder', 'onion powder', 'cayenne', 'dried basil', 'dried thyme', 'thyme', 'rosemary',
    'ground ginger', 'seasoning',
  ].map((keyword) => p(keyword, 45, 'g', 1.0, { pantry: true })),
  p('salt', 750, 'g', 0.65, { pantry: true }),
  p('black pepper', 100, 'g', 1.4, { pantry: true }),
  p('salt and pepper', 100, 'g', 1.4, { pantry: true }),
  p('water', 1000, 'ml', 0, { pantry: true }),

  // Cooking & Baking
  p('oil', 1000, 'ml', 1.8, { pantry: true }),
  p('olive oil', 500, 'ml', 4.5, { pantry: true }),
  p('flour', 1500, 'g', 0.75, { pantry: true }),
  p('sugar', 1000, 'g', 1.0, { pantry: true }),
  p('baking powder', 170, 'g', 1.0, { pantry: true }),
  p('bicarbonate of soda', 200, 'g', 0.9, { pantry: true }),
  p('yeast', 56, 'g', 1.0, { pantry: true }),
  p('cornflour', 250, 'g', 0.95, { pantry: true }),
  p('vanilla', 38, 'ml', 1.5, { pantry: true }),
  p('cocoa', 250, 'g', 2.5, { pantry: true }),
  p('chocolate', 100, 'g', 1.0),
  p('breadcrumb', 250, 'g', 0.85),
  p('gravy', 170, 'g', 1.3, { pantry: true }),
  p('stock cube', 8, 'each', 0.75, { pantry: true }),
  // A stock cube makes ~500 ml, so 8 cubes ≈ 4 litres of stock
  // (the meat/veg variants are listed too, or "chicken stock" would match the
  // longer keyword "chicken" and get priced as raw chicken)
  ...['stock', 'chicken stock', 'beef stock', 'vegetable stock', 'veg stock', 'fish stock'].map((keyword) =>
    p(keyword, 4000, 'ml', 0.75, { pantry: true })
  ),
  ...['chicken stock cube', 'beef stock cube', 'vegetable stock cube', 'veg stock cube'].map((keyword) =>
    p(keyword, 8, 'each', 0.75, { pantry: true })
  ),

  // Sauces & Condiments — mostly pantry
  p('soy sauce', 150, 'ml', 1.0, { pantry: true }),
  p('ketchup', 460, 'g', 1.5, { pantry: true }),
  p('mayonnaise', 400, 'g', 1.5, { pantry: true }),
  p('mustard', 180, 'g', 1.0, { pantry: true }),
  p('vinegar', 350, 'ml', 0.4, { pantry: true }),
  p('worcestershire sauce', 150, 'ml', 1.2, { pantry: true }),
  p('hot sauce', 150, 'ml', 1.5, { pantry: true }),
  p('sweet chilli sauce', 300, 'ml', 1.2, { pantry: true }),
  p('fish sauce', 150, 'ml', 1.4, { pantry: true }),
  p('oyster sauce', 150, 'ml', 1.4, { pantry: true }),
  p('bbq sauce', 480, 'g', 1.5, { pantry: true }),
  p('lemon juice', 250, 'ml', 0.6, { pantry: true }),
  p('lime juice', 250, 'ml', 0.8, { pantry: true }),

  // Frozen
  p('oven chip', 1500, 'g', 1.8),
  p('ice cream', 1000, 'ml', 1.8),
];
