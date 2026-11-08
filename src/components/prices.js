import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePriceTable } from '../hooks/usePriceTable.js';
import { findPrice, describePrice, convertToPackUnits } from '../utils/priceUtils.js';
import { PRICE_DATA_LABEL } from '../utils/defaultPrices.js';

const PACK_UNITS = ['g', 'kg', 'ml', 'l', 'each', 'clove', 'bunch', 'packet'];
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'yours', label: 'Your prices' },
];

// Every distinct ingredient across the user's recipes: lowercase name →
// { display name, recipe count, units it's used in }.
function collectIngredients(recipes) {
  const byName = {};
  recipes.forEach((recipe) => {
    const seenInThisRecipe = new Set();
    (recipe.ingredients_structured ?? []).forEach((ing) => {
      const name = (ing.name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!byName[key]) byName[key] = { key, name, recipeCount: 0, uses: [] };
      if (!seenInThisRecipe.has(key)) {
        byName[key].recipeCount += 1;
        seenInThisRecipe.add(key);
      }
      if (ing.quantity !== null && ing.quantity !== undefined && ing.quantity !== '') {
        byName[key].uses.push({ quantity: Number(ing.quantity), unit: ing.unit });
      }
    });
  });
  return Object.values(byName).sort((a, b) => a.name.localeCompare(b.name));
}

// What, if anything, is wrong with the price for this ingredient.
function priceProblem(ingredient, found) {
  if (!found) return 'No price';
  const badUnit = ingredient.uses.find((u) => !convertToPackUnits(u.quantity, u.unit, found.price));
  if (badUnit) return `Can't convert "${badUnit.unit || 'each'}"`;
  return null;
}

const emptyForm = { packPrice: '', packSize: '', packUnit: 'g', eachAmount: '', pantry: false };

export default function Prices({ userId }) {
  const { table, loading: pricesLoading, error: priceError, reload } = usePriceTable(userId);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('recipes')
      .select('id, ingredients_structured')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRecipes(data ?? []);
        setLoading(false);
      });
  }, [userId]);

  const ingredients = collectIngredients(recipes).map((ing) => {
    const found = findPrice(ing.name, table);
    return { ...ing, found, problem: priceProblem(ing, found) };
  });

  const visible = ingredients.filter((ing) => {
    if (search && !ing.key.includes(search.trim().toLowerCase())) return false;
    if (filter === 'attention') return !!ing.problem;
    if (filter === 'yours') return ing.found?.source === 'yours';
    return true;
  });
  const attentionCount = ingredients.filter((i) => i.problem).length;

  const startEdit = (ing) => {
    const price = ing.found?.price;
    setForm(
      price
        ? {
            packPrice: String(price.packPrice),
            packSize: String(price.packSize),
            packUnit: price.packUnit,
            eachAmount: price.eachAmount ? String(price.eachAmount) : '',
            pantry: !!price.pantry,
          }
        : { ...emptyForm, packUnit: ing.uses[0]?.unit || 'g' }
    );
    setEditingKey(ing.key);
    setError('');
  };

  const handleSave = async () => {
    const packPrice = parseFloat(form.packPrice);
    const packSize = parseFloat(form.packSize);
    if (Number.isNaN(packPrice) || packPrice < 0 || Number.isNaN(packSize) || packSize <= 0 || !form.packUnit.trim()) {
      setError('Enter a price, a pack size above 0, and a unit.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('ingredient_prices').upsert(
      {
        user_id: userId,
        ingredient_name: editingKey,
        pack_price: packPrice,
        pack_size: packSize,
        pack_unit: form.packUnit.trim(),
        each_amount: form.eachAmount ? parseFloat(form.eachAmount) : null,
        is_pantry: form.pantry,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,ingredient_name' }
    );
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingKey(null);
    reload();
  };

  const handleReset = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('ingredient_prices')
      .delete()
      .eq('user_id', userId)
      .eq('ingredient_name', editingKey);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingKey(null);
    reload();
  };

  const unitOptions = PACK_UNITS.includes(form.packUnit) ? PACK_UNITS : [...PACK_UNITS, form.packUnit];

  return (
    <div className="page">
      <div className="page-header">
        <h2>Ingredient Prices</h2>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        {PRICE_DATA_LABEL}. Your prices are used for recipe costs, the shopping list total and the meal plan
        generator. Mark cupboard staples (oil, spices) as <em>pantry</em> to keep them out of the weekly shop total.
      </p>

      {priceError && <p className="error">{priceError}</p>}

      <div className="row" style={{ marginBottom: '12px' }}>
        <input
          type="search"
          placeholder="Search ingredients"
          aria-label="Search ingredients"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px', minWidth: '200px' }}
          className="grow"
        />
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`btn ${filter === f.id ? 'btn-primary' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {f.id === 'attention' && attentionCount > 0 ? ` (${attentionCount})` : ''}
          </button>
        ))}
      </div>

      {loading || pricesLoading ? (
        <p>Loading prices...</p>
      ) : ingredients.length === 0 ? (
        <p className="muted">No ingredients yet — prices show up here once your recipes have ingredients.</p>
      ) : visible.length === 0 ? (
        <p className="muted">Nothing matches.</p>
      ) : (
        <div className="card" style={{ padding: '4px 16px' }}>
          {visible.map((ing) => (
            <div key={ing.key}>
              <div className="list-row">
                <div className="grow">
                  <div>
                    <strong>{ing.name}</strong>{' '}
                    <span className="muted small">
                      · {ing.recipeCount} recipe{ing.recipeCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="small" style={{ marginTop: '2px' }}>
                    {ing.found ? (
                      <>
                        <span className="money">{describePrice(ing.found.price)}</span>{' '}
                        <span className={`pill ${ing.found.source === 'yours' ? 'pill-green' : ''}`}>
                          {ing.found.source === 'yours' ? 'your price' : `starter: ${ing.found.matchedOn}`}
                        </span>
                        {ing.found.price.pantry && <span className="pill">pantry</span>}
                      </>
                    ) : null}
                    {ing.problem && <span className="pill pill-amber">{ing.problem}</span>}
                  </div>
                </div>
                <button className="btn" onClick={() => (editingKey === ing.key ? setEditingKey(null) : startEdit(ing))}>
                  {editingKey === ing.key ? 'Close' : 'Edit'}
                </button>
              </div>

              {editingKey === ing.key && (
                <div style={{ background: 'var(--bg)', borderRadius: '6px', padding: '12px', margin: '4px 0 10px' }}>
                  <div className="row">
                    <div className="field" style={{ width: '110px' }}>
                      <label htmlFor="price-pack-price">Pack price £</label>
                      <input
                        id="price-pack-price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.packPrice}
                        onChange={(e) => setForm({ ...form, packPrice: e.target.value })}
                      />
                    </div>
                    <div className="field" style={{ width: '110px' }}>
                      <label htmlFor="price-pack-size">Pack size</label>
                      <input
                        id="price-pack-size"
                        type="number"
                        step="any"
                        min="0"
                        value={form.packSize}
                        onChange={(e) => setForm({ ...form, packSize: e.target.value })}
                      />
                    </div>
                    <div className="field" style={{ width: '110px' }}>
                      <label htmlFor="price-pack-unit">Unit</label>
                      <select
                        id="price-pack-unit"
                        value={form.packUnit}
                        onChange={(e) => setForm({ ...form, packUnit: e.target.value })}
                      >
                        {unitOptions.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field" style={{ width: '150px' }}>
                      <label htmlFor="price-each">One item = (g/ml)</label>
                      <input
                        id="price-each"
                        type="number"
                        step="any"
                        min="0"
                        placeholder="optional"
                        value={form.eachAmount}
                        onChange={(e) => setForm({ ...form, eachAmount: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="muted small" style={{ margin: '0 0 10px' }}>
                    "One item" lets counted ingredients (2 onions, 1 can) be costed against a price by weight, and the
                    other way round.
                    {ing.uses.length > 0 &&
                      ` Your recipes use it as: ${[...new Set(ing.uses.map((u) => u.unit || 'each'))].join(', ')}.`}
                  </p>
                  <label className="small" style={{ display: 'block', marginBottom: '10px' }}>
                    <input
                      type="checkbox"
                      checked={form.pantry}
                      onChange={(e) => setForm({ ...form, pantry: e.target.checked })}
                      style={{ marginRight: '6px' }}
                    />
                    Pantry staple (leave out of the weekly shop total)
                  </label>
                  {error && <p className="error">{error}</p>}
                  <div className="row">
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save price'}
                    </button>
                    {ing.found?.source === 'yours' && (
                      <button className="btn" onClick={handleReset} disabled={saving}>
                        Reset to starter price
                      </button>
                    )}
                    <button className="btn" onClick={() => setEditingKey(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {error && !editingKey && <p className="error">{error}</p>}
    </div>
  );
}
