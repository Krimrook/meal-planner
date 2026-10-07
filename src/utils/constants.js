// Shared constant lists used across Onboarding, Settings, and RecipeLibrary —
// pulled out here so all three stay in sync instead of maintaining separate copies.

export const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Low-Carb', 'High-Protein'];

export const SUPERMARKETS = ['Tesco', "Sainsbury's", 'Asda', 'Morrisons', 'Aldi', 'Lidl', 'Waitrose'];

// Common cooking units, offered as suggestions on the ingredient "Unit" field.
// This is a <datalist> source, not a locked list — the field stays a free-text
// input underneath, so anything not in this list can still be typed in directly.
export const COMMON_UNITS = [
  'g',
  'kg',
  'mg',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'oz',
  'lb',
  'clove',
  'pinch',
  'slice',
  'can',
  'jar',
  'packet',
  'piece',
  'bunch',
  'handful',
];

// Common freeform meal-plan notes, offered as suggestions on the Meal Plan's
// "Custom Note" field. Same <datalist> pattern as COMMON_UNITS above — these
// are shortcuts, not a restriction, so any note can still be typed.
export const COMMON_MEAL_NOTES = ['Leftovers', 'Eating out', 'Takeaway', 'Meal prep', 'Skipping this meal'];

// Shopping List aisles, in the order they're shown — roughly the order you'd
// walk a UK supermarket. The order of this array IS the display order, so
// reordering it here reorders the Shopping List. 'Other' stays last: it's the
// fallback for anything guessAisle() (shoppinglistutils.js) can't place.
export const AISLES = [
  'Fruit & Veg',
  'Meat & Fish',
  'Dairy & Eggs',
  'Bakery',
  'Pasta, Rice & Grains',
  'Tins & Jars',
  'Herbs & Spices',
  'Cooking & Baking',
  'Sauces & Condiments',
  'Frozen',
  'Other',
];

export const DEFAULT_AISLE = 'Other';

// Words that decide the aisle on their own, whatever the ingredient is —
// "frozen peas" belongs in Frozen even though "peas" is a Fruit & Veg keyword.
export const AISLE_QUALIFIERS = {
  frozen: 'Frozen',
  tinned: 'Tins & Jars',
  canned: 'Tins & Jars',
};

// Keyword → aisle lookup used to guess an aisle from an ingredient name.
// Singular forms only: guessAisle() also matches a trailing "s"/"es", so
// "tomato" covers "tomatoes". When several keywords match, the longest wins —
// that's why "coconut milk" (Tins & Jars) beats "milk" (Dairy & Eggs).
// To teach the guesser a new ingredient, add its name to the right list.
export const AISLE_KEYWORDS = {
  'Fruit & Veg': [
    'onion', 'garlic', 'potato', 'sweet potato', 'carrot', 'tomato', 'pepper', 'chilli', 'mushroom',
    'courgette', 'aubergine', 'broccoli', 'cauliflower', 'cabbage', 'spinach', 'kale', 'lettuce', 'rocket',
    'cucumber', 'celery', 'leek', 'spring onion', 'shallot', 'ginger', 'pea', 'green bean', 'sweetcorn',
    'squash', 'parsnip', 'beetroot', 'avocado', 'lemon', 'lime', 'orange', 'apple', 'banana', 'berries',
    'strawberry', 'blueberry', 'raspberry', 'grape', 'mango', 'pineapple', 'coriander', 'parsley', 'basil',
    'mint', 'thyme', 'rosemary', 'dill', 'chive', 'salad',
  ],
  'Meat & Fish': [
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'mince', 'steak', 'bacon', 'sausage', 'ham', 'chorizo',
    'gammon', 'duck', 'salmon', 'cod', 'haddock', 'prawn', 'fish', 'mackerel', 'trout',
  ],
  'Dairy & Eggs': [
    'milk', 'butter', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'halloumi', 'yoghurt', 'yogurt',
    'cream', 'creme fraiche', 'egg', 'margarine',
  ],
  Bakery: ['bread', 'roll', 'bun', 'wrap', 'tortilla', 'pitta', 'naan', 'bagel', 'baguette', 'croissant'],
  'Pasta, Rice & Grains': [
    'pasta', 'spaghetti', 'penne', 'fusilli', 'lasagne', 'noodle', 'egg noodle', 'rice', 'couscous', 'quinoa',
    'oat', 'lentil', 'barley', 'cereal',
  ],
  'Tins & Jars': [
    'chopped tomato', 'plum tomato', 'tomato puree', 'passata', 'baked bean', 'kidney bean', 'butter bean',
    'black bean', 'chickpea', 'coconut milk', 'tuna', 'sardine', 'olive', 'peanut butter', 'jam', 'honey',
    'pesto', 'curry paste', 'soup',
  ],
  'Herbs & Spices': [
    'salt', 'black pepper', 'paprika', 'cumin', 'turmeric', 'chilli powder', 'chilli flake', 'curry powder',
    'garam masala', 'ground coriander', 'coriander seed', 'cinnamon', 'nutmeg', 'oregano', 'mixed herb',
    'bay leaf', 'garlic powder', 'onion powder', 'cayenne', 'dried basil', 'dried thyme', 'dried parsley',
    'dried rosemary', 'ground ginger', 'seasoning',
  ],
  'Cooking & Baking': [
    'oil', 'olive oil', 'flour', 'sugar', 'baking powder', 'bicarbonate of soda', 'yeast', 'stock',
    'stock cube', 'chicken stock', 'beef stock', 'vegetable stock', 'cornflour', 'vanilla', 'cocoa',
    'chocolate', 'breadcrumb', 'gravy',
  ],
  'Sauces & Condiments': [
    'soy sauce', 'ketchup', 'mayonnaise', 'mustard', 'vinegar', 'worcestershire sauce', 'hot sauce',
    'sweet chilli sauce', 'fish sauce', 'oyster sauce', 'bbq sauce', 'sauce', 'lemon juice', 'lime juice',
  ],
  Frozen: ['ice cream', 'oven chip'],
};