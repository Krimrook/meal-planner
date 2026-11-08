// Component tests for the Day 10 budget screens, driven by the same Supabase
// mock as the rest of the suite (src/lib/__mocks__/supabase.js).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Prices from './prices.js';
import ShoppingList from './shoppingList.js';
import Welcome from './welcome.js';
import { toISODate, getMonday } from '../utils/dateutils.js';

jest.mock('../lib/supabase');
// eslint-disable-next-line import/first
import { supabase } from '../lib/supabase';

const profile = { budget: 40, household_size: 2, preferred_supermarket: 'Tesco', dietary_preferences: [] };

const curry = {
  name: 'Curry',
  servings: 4,
  ingredients_structured: [
    { name: 'Rice', quantity: 400, unit: 'g' },
    { name: 'Chicken', quantity: 500, unit: 'g' },
    { name: 'Moon dust', quantity: 1, unit: 'g' },
  ],
};

const myPrices = [
  { ingredient_name: 'rice', pack_size: 1000, pack_unit: 'g', pack_price: 2, each_amount: null, is_pantry: false },
  { ingredient_name: 'chicken', pack_size: 500, pack_unit: 'g', pack_price: 3, each_amount: null, is_pantry: false },
];

beforeEach(() => {
  supabase.__reset();
  localStorage.clear();
});

function inRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Prices screen', () => {
  test('lists recipe ingredients with their price source, and flags unpriced ones', async () => {
    supabase.__table('ingredient_prices').__setResult({ data: myPrices, error: null });
    supabase.__table('recipes').__queueResult({ data: [{ id: 'r1', ingredients_structured: curry.ingredients_structured }], error: null });

    inRouter(<Prices userId="u1" />);

    expect(await screen.findByText('Rice')).toBeInTheDocument();
    expect(screen.getAllByText('your price')).toHaveLength(2);
    expect(screen.getByText('No price')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /needs attention/i }));
    expect(screen.queryByText('Rice')).not.toBeInTheDocument();
    expect(screen.getByText('Moon dust')).toBeInTheDocument();
  });

  test('saving a price upserts it for the lowercase ingredient name', async () => {
    supabase.__table('ingredient_prices').__setResult({ data: [], error: null });
    supabase.__table('recipes').__queueResult({
      data: [{ id: 'r1', ingredients_structured: [{ name: 'Moon Dust', quantity: 1, unit: 'g' }] }],
      error: null,
    });

    inRouter(<Prices userId="u1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText(/pack price/i), { target: { value: '9.99' } });
    fireEvent.change(screen.getByLabelText(/pack size/i), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /save price/i }));

    await waitFor(() =>
      expect(supabase.__table('ingredient_prices').upsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'u1', ingredient_name: 'moon dust', pack_price: 9.99, pack_size: 100, pack_unit: 'g' }),
        { onConflict: 'user_id,ingredient_name' }
      )
    );
  });

  test('refuses to save without a pack size', async () => {
    supabase.__table('ingredient_prices').__setResult({ data: [], error: null });
    supabase.__table('recipes').__queueResult({
      data: [{ id: 'r1', ingredients_structured: [{ name: 'Moon Dust', quantity: 1, unit: 'g' }] }],
      error: null,
    });

    inRouter(<Prices userId="u1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText(/pack price/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /save price/i }));

    expect(await screen.findByText(/pack size above 0/i)).toBeInTheDocument();
    expect(supabase.__table('ingredient_prices').upsert).not.toHaveBeenCalled();
  });
});

describe('Shopping List costs', () => {
  function setup() {
    supabase.__table('ingredient_prices').__setResult({ data: myPrices, error: null });
    supabase.__table('meal_plan_entries').__queueResult({
      data: [{ plan_date: '2026-11-09', meal_slot: 'dinner', recipe: curry }],
      error: null,
    });
    supabase.__table('shopping_list_checked_items').__queueResult({ data: [], error: null });
    supabase.__table('ingredient_aisles').__queueResult({ data: [], error: null });
  }

  test('scales to the household and shows the estimated shop against the budget', async () => {
    setup();
    inRouter(<ShoppingList userId="u1" profile={profile} />);

    // Household of 2 halves the 4-serving curry: 200 g rice, 250 g chicken
    expect(await screen.findByText('200 g Rice')).toBeInTheDocument();
    expect(screen.getByText('250 g Chicken')).toBeInTheDocument();
    // One bag of rice (£2) + one pack of chicken (£3)
    expect(screen.getByText('£5.00')).toBeInTheDocument();
    expect(screen.getByText(/of £40\.00/)).toBeInTheDocument();
    expect(screen.getByText('no price')).toBeInTheDocument();
  });

  test('turning scaling off shows the recipe as written', async () => {
    setup();
    inRouter(<ShoppingList userId="u1" profile={profile} />);

    fireEvent.click(await screen.findByLabelText(/scale recipes to household/i));
    expect(screen.getByText('400 g Rice')).toBeInTheDocument();
    expect(localStorage.getItem('scaleToHousehold')).toBe('false');
  });
});

describe('Welcome dashboard', () => {
  test("shows this week's estimate and what's planned today", async () => {
    supabase.__table('ingredient_prices').__setResult({ data: myPrices, error: null });
    supabase.__table('meal_plan_entries').__queueResult({
      data: [{ plan_date: toISODate(new Date()), meal_slot: 'dinner', recipe: curry }],
      error: null,
    });

    inRouter(<Welcome user={{ id: 'u1', email: 'scott@example.com' }} profile={profile} />);

    expect(await screen.findByText('Curry')).toBeInTheDocument();
    expect(screen.getByText('1 / 21')).toBeInTheDocument();
    expect(screen.getByText(/£35\.00 left to plan with/)).toBeInTheDocument();
    expect(supabase.__table('meal_plan_entries').gte).toHaveBeenCalledWith('plan_date', toISODate(getMonday(new Date())));
  });
});
