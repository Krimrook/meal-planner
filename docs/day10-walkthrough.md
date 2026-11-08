# Day 10: Budget features and polish pass (walkthrough)

This was one large drop rather than the usual one-feature-per-day, so this file explains how it fits together. Read it before merging.

## Before you merge: run the SQL first

Run `supabase/day10-budget-migration.sql` in the Supabase SQL editor **before** deploying. It:

1. creates `ingredient_prices`, your own prices (RLS, one row per ingredient name, same idea as `ingredient_aisles`)
2. adds `recipes.meal_types text[]` (breakfast/lunch/dinner; empty = any)

If you deploy without running it, prices fall back to the starter list (with a warning on screen), but **saving a recipe will fail**, because the form now sends `meal_types`.

## What's new for you as a user

| Screen | What changed |
|---|---|
| Home | Now a dashboard: this week's estimated shop against your budget (progress bar), meals planned out of 21, cost per person per day, today's meals |
| Meal Plan | Estimated weekly shop under the week picker; **Generate week** fills empty slots from your recipes within budget, with a preview before anything is saved |
| Shopping List | Cost per item and a week total against your budget; "in trolley" running total as you tick items; **scale to household** toggle; aisle **reset** (back to the automatic guess) |
| Recipes | Cost per serving and cost for your household on each card; "Good for" breakfast/lunch/dinner tags; search, tag filter, sort by cheapest |
| Prices (new) | Every ingredient in your recipes, with its price (starter or yours), a "needs attention" filter, and edit/reset |
| Nav bar | Prices link; Log Out moved here from Home |
| Onboarding/Settings | Budget and household size can't be left blank any more (they drive every cost) |

## How the money works (the important bit)

There are four new pure modules in `src/utils/`, each with its own test file:

- **`defaultPrices.js`**: the starter price list. These are rough UK standard-range prices **estimated by Claude, not live data**. Each entry has a `keyword`, `packSize`, `packUnit`, `packPrice`, optional `eachAmount` (grams in one item, so "2 onions" can be costed against a price per kg) and optional `pantry`.
- **`priceUtils.js`** handles units and finding a price:
  - `normalizeUnit` / `toBase` turn "Grams", "kg", "tbsp" into grams or ml. Counted things ("", can, slice, rasher) become `each`.
  - `findPrice(name)` checks **your price for the exact name first**, then the most specific starter keyword. This is the same longest-whole-word matching as `guessAisle` (now shared through `matchUtils.js`).
  - There are two kinds of cost. `usedCost` is the share of the pack a recipe uses (cost per serving). `shopCost` is whole packs, rounded up (what you pay at the till).
- **`budgetUtils.js`** works at the level of a week or a recipe:
  - `scaleFactor(servings, household)`: a recipe for 4 cooked for 2 gives 0.5
  - `buildWeekGroups` turns meal plan rows into shopping list groups, scaled if asked
  - `costItems` costs and totals the week. The same ingredient in different units (200 g + half a can of tomatoes) is **added together before rounding to packs**, so you aren't charged for two tins.
  - `recipeCost` / `mealCost`
- **`planGenerator.js`** works through the empty slots one at a time. For each slot it filters recipes by meal type, diet and repeat limit (2 per week), aims for a fair share of the budget left (money left ÷ slots left), prefers the least-used recipes, and avoids the same recipe two days running. If even the cheapest option won't fit, it leaves the slot empty and says why. Randomness is injectable, so the tests are deterministic.

Pantry staples (oil, spices, stock) are costed per recipe but **left out of the weekly shop total**, because you don't rebuy them every week. The shopping list shows what they'd cost if you're out.

### Known limits (be aware of these)

- The starter prices are ballpark figures. The Prices screen is where you make them yours.
- Converting between weight and volume assumes 1 g = 1 ml. That's fine for milk and oil and a bit rough for flour, so those totals get a ≈.
- "No quantity" items ("salt", "onion") count as one pack on the shopping list.
- The generator's per-meal figures are share-of-pack costs. The whole-pack shop total shown under them is usually a bit higher.
- The scale-to-household setting is stored per device (localStorage, the same pattern as the remembered week).

## Smaller fixes and polish

- **Bug:** ingredient-name autocomplete (Day 8) never actually showed. The `<datalist>` had ended up *inside* the "+ Add Ingredient" button, and the name inputs didn't have `list="ingredient-suggestions"`. Both are fixed.
- A failed aisle save now reverts the item to its old aisle instead of leaving it misplaced until refresh (a Day 9 known limit).
- `parseISODate` in `dateutils.js` parses `YYYY-MM-DD` as a local date, so day labels can't slip a day in timezones behind UTC.
- The React Router v7 future flags are set on `BrowserRouter` (the Day 5 console warnings). Tests still log them, because the tests use `MemoryRouter`.
- Styling pass: `app.css` replaces the unused CRA boilerplate with base styles (`box-sizing`, buttons, inputs) and a few classes (`.page`, `.card`, `.pill`, `.budget-meter`). Existing inline styles still work; new screens use the classes. The meal plan table scrolls sideways on phones.
- Labels in Onboarding and Settings now have `htmlFor`/`id` pairs (the same accessibility gap Day 4 found in Login/Signup).
- The per-screen Back buttons were removed from Meal Plan, Shopping List and Recipes, since the nav bar covers them. Settings' Back is now Cancel.

## Tests

`npm test` gives **116 passing** across 10 suites (up from 64). New: `priceUtils.test.js`, `budgetUtils.test.js`, `planGenerator.test.js`, `budgetScreens.test.js` (component tests for Prices, Shopping List costs and the Home dashboard), plus `parseISODate`. The work was also checked visually in a browser against an in-memory fake Supabase (not committed).

## Suggested way to review

1. Run the SQL.
2. `git checkout budget-and-polish`, `npm install`, `npm test`, `npm start`.
3. Go to Prices and fix anything flagged under "Needs attention".
4. Meal Plan → Generate week → preview → Save, then check the Shopping List total.
5. Merge, push and deploy as usual, then retest on the live site.
