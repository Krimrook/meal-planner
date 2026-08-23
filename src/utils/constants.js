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