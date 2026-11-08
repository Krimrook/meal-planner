import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DIETARY_OPTIONS, COMMON_UNITS } from '../utils/constants';
import { usePriceTable } from '../hooks/usePriceTable.js';
import { recipeCost, scaleFactor } from '../utils/budgetUtils.js';
import { formatMoney } from '../utils/priceUtils.js';

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
];

const emptyIngredientRow = () => ({ name: '', quantity: '', unit: '' });

const emptyForm = {
  name: '',
  servings: '',
  prepTimeMinutes: '',
  ingredients: [emptyIngredientRow()],
  instructions: '',
  dietaryTags: [],
  mealTypes: [],
};

function formatIngredient(ing) {
  const parts = [];
  if (ing.quantity !== null && ing.quantity !== undefined && ing.quantity !== '') parts.push(ing.quantity);
  if (ing.unit) parts.push(ing.unit);
  parts.push(ing.name);
  return parts.join(' ');
}

export default function RecipeLibrary({ userId, profile }) {
  const { table: priceTable } = usePriceTable(userId);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'name' | 'cost'
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchRecipes = () => {
    setLoading(true);
    return supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRecipes(data ?? []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDietaryTag = (tag) => {
    setForm((prev) => ({
      ...prev,
      dietaryTags: prev.dietaryTags.includes(tag)
        ? prev.dietaryTags.filter((t) => t !== tag)
        : [...prev.dietaryTags, tag],
    }));
  };

  const toggleMealType = (type) => {
    setForm((prev) => ({
      ...prev,
      mealTypes: prev.mealTypes.includes(type) ? prev.mealTypes.filter((t) => t !== type) : [...prev.mealTypes, type],
    }));
  };

  const updateIngredientRow = (index, field, value) => {
    setForm((prev) => {
      const next = [...prev.ingredients];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, ingredients: next };
    });
  };

  const addIngredientRow = () => {
    setForm((prev) => ({ ...prev, ingredients: [...prev.ingredients, emptyIngredientRow()] }));
  };

  const removeIngredientRow = (index) => {
    setForm((prev) => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) }));
  };

  const startAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setView('form');
  };

  const startEdit = (recipe) => {
    const ingredientRows =
      recipe.ingredients_structured?.length > 0
        ? recipe.ingredients_structured.map((ing) => ({
            name: ing.name ?? '',
            quantity: ing.quantity !== null && ing.quantity !== undefined ? String(ing.quantity) : '',
            unit: ing.unit ?? '',
          }))
        : [emptyIngredientRow()];

    setForm({
      name: recipe.name,
      servings: recipe.servings ?? '',
      prepTimeMinutes: recipe.prep_time_minutes ?? '',
      ingredients: ingredientRows,
      instructions: recipe.instructions ?? '',
      dietaryTags: recipe.dietary_tags ?? [],
      mealTypes: recipe.meal_types ?? [],
    });
    setEditingId(recipe.id);
    setError('');
    setView('form');
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Recipe name is required.');
      return;
    }

    setError('');
    setSaving(true);

    const cleanedIngredients = form.ingredients
      .map((row) => ({
        name: row.name.trim(),
        quantity: row.quantity !== '' ? parseFloat(row.quantity) : null,
        unit: row.unit.trim() || null,
      }))
      .filter((row) => row.name);

    const payload = {
      name: form.name.trim(),
      servings: form.servings ? parseInt(form.servings, 10) : null,
      prep_time_minutes: form.prepTimeMinutes ? parseInt(form.prepTimeMinutes, 10) : null,
      ingredients_structured: cleanedIngredients,
      instructions: form.instructions.trim(),
      dietary_tags: form.dietaryTags,
      meal_types: form.mealTypes,
    };

    const { error } = editingId
      ? await supabase.from('recipes').update(payload).eq('id', editingId)
      : await supabase.from('recipes').insert({ ...payload, user_id: userId });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setView('list');
    fetchRecipes();
  };

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }

    const { error } = await supabase.from('recipes').delete().eq('id', id);

    if (error) {
      setError(error.message);
    } else {
      setConfirmDeleteId(null);
      fetchRecipes();
    }
  };

 // Unique ingredient names across all of this user's recipes, derived from the
  // recipes already in state (no extra Supabase query). Feeds the
  // ingredient-suggestions datalist below.
  const knownIngredientNames = Array.from(
    new Set(
      recipes.flatMap((r) =>
        (r.ingredients_structured ?? []).map((ing) => ing.name).filter(Boolean)
      )
    )
  ).sort();
  
  if (view === 'form') {
    return (
      <div className="page page-narrow">
        <h2>{editingId ? 'Edit Recipe' : 'Add Recipe'}</h2>

        <div style={{ marginBottom: '15px' }}>
          <label>Recipe Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label>Servings</label>
            <input
              type="number"
              value={form.servings}
              onChange={(e) => setForm({ ...form, servings: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Prep Time (min)</label>
            <input
              type="number"
              value={form.prepTimeMinutes}
              onChange={(e) => setForm({ ...form, prepTimeMinutes: e.target.value })}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Ingredients</label>
          <p style={{ fontSize: '12px', color: '#666', margin: '4px 0' }}>
            Use decimals for fractions (0.5 instead of ½). Leave quantity/unit blank for things like
            "1 onion" or "salt to taste". Unit has suggestions, but you can type anything.
          </p>
          {form.ingredients.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
              <input
                type="number"
                step="any"
                placeholder="Qty"
                value={row.quantity}
                onChange={(e) => updateIngredientRow(i, 'quantity', e.target.value)}
                style={{ width: '70px', padding: '8px' }}
              />
              <input
                list="unit-suggestions"
                type="text"
                placeholder="Unit (g, cups...)"
                value={row.unit}
                onChange={(e) => updateIngredientRow(i, 'unit', e.target.value)}
                style={{ width: '120px', padding: '8px' }}
              />
              <input
                type="text"
                list="ingredient-suggestions"
                placeholder="Ingredient name"
                value={row.name}
                onChange={(e) => updateIngredientRow(i, 'name', e.target.value)}
                style={{ flex: 1, padding: '8px' }}
              />
              <button
                type="button"
                onClick={() => removeIngredientRow(i)}
                style={{ padding: '8px 10px', cursor: 'pointer' }}
                aria-label="Remove ingredient"
              >
                ×
              </button>
            </div>
          ))}
          {/* Shared by every unit input above via the list="unit-suggestions" attribute —
              one <datalist> in the DOM is enough for all of them. Native browser combobox:
              shows a dropdown of suggestions on focus/typing, but the field stays free text,
              so anything not in COMMON_UNITS can still be typed in directly. */}
          <datalist id="unit-suggestions">
            {COMMON_UNITS.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={addIngredientRow}
            style={{ marginTop: '10px', padding: '6px 12px', cursor: 'pointer' }}
          >
            + Add Ingredient
          </button>
          {/* Same pattern as unit-suggestions: suggestions only, the field stays
              free text. Built from the user's own saved recipes. (Day 10 fix:
              this used to sit *inside* the button above, and the name inputs
              were missing list="ingredient-suggestions", so it never showed.) */}
          <datalist id="ingredient-suggestions">
            {knownIngredientNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Instructions</label>
          <textarea
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            rows={6}
            style={{ width: '100%', padding: '8px', marginTop: '5px', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>Good for</label>
          <p style={{ fontSize: '12px', color: '#666', margin: '4px 0' }}>
            Used by "Generate week" on the Meal Plan. Leave all unticked if it suits any meal.
          </p>
          <div className="checkbox-row">
            {MEAL_TYPES.map((type) => (
              <label key={type.id}>
                <input
                  type="checkbox"
                  checked={form.mealTypes.includes(type.id)}
                  onChange={() => toggleMealType(type.id)}
                  style={{ marginRight: '6px' }}
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label>Dietary Tags</label>
          {DIETARY_OPTIONS.map((tag) => (
            <label key={tag} style={{ display: 'block', marginTop: '8px' }}>
              <input
                type="checkbox"
                checked={form.dietaryTags.includes(tag)}
                onChange={() => toggleDietaryTag(tag)}
                style={{ marginRight: '8px' }}
              />
              {tag}
            </label>
          ))}
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setView('list')} style={{ flex: 1, padding: '10px' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px' }}>
            {saving ? 'Saving...' : 'Save Recipe'}
          </button>
        </div>
      </div>
    );
  }

  const householdSize = Number(profile?.household_size) || null;

  const costed = recipes.map((recipe) => ({ recipe, cost: recipeCost(recipe, priceTable) }));
  const needle = search.trim().toLowerCase();
  const visible = costed
    .filter(({ recipe }) => !needle || recipe.name.toLowerCase().includes(needle))
    .filter(({ recipe }) => !tagFilter || (recipe.dietary_tags ?? []).includes(tagFilter))
    .sort((a, b) => {
      if (sortBy === 'name') return a.recipe.name.localeCompare(b.recipe.name);
      if (sortBy === 'cost') return (a.cost.perServing ?? Infinity) - (b.cost.perServing ?? Infinity);
      return 0; // 'newest' — already in created_at order from the query
    });

  return (
    <div className="page">
      <div className="page-header">
        <h2>My Recipes</h2>
        <button className="btn btn-primary" onClick={startAdd}>
          + Add Recipe
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {recipes.length > 0 && (
        <div className="row" style={{ marginBottom: '12px' }}>
          <input
            type="search"
            placeholder="Search recipes"
            aria-label="Search recipes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="grow"
            style={{ padding: '8px', minWidth: '160px' }}
          />
          <select aria-label="Filter by tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} style={{ padding: '8px' }}>
            <option value="">All tags</option>
            {DIETARY_OPTIONS.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select aria-label="Sort recipes" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '8px' }}>
            <option value="newest">Newest</option>
            <option value="name">A–Z</option>
            <option value="cost">Cheapest per serving</option>
          </select>
        </div>
      )}

      {loading ? (
        <p>Loading recipes...</p>
      ) : recipes.length === 0 ? (
        <p className="muted">No recipes yet. Add your first one above.</p>
      ) : visible.length === 0 ? (
        <p className="muted">No recipes match.</p>
      ) : (
        visible.map(({ recipe, cost }) => (
          <div key={recipe.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              <h3 style={{ margin: '0 0 6px 0' }}>{recipe.name}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => startEdit(recipe)} style={{ padding: '4px 10px' }}>
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(recipe.id)}
                  style={{
                    padding: '4px 10px',
                    color: confirmDeleteId === recipe.id ? 'white' : 'inherit',
                    background: confirmDeleteId === recipe.id ? '#c0392b' : undefined,
                  }}
                >
                  {confirmDeleteId === recipe.id ? 'Confirm?' : 'Delete'}
                </button>
              </div>
            </div>

            <p className="muted small" style={{ margin: '0 0 8px 0' }}>
              {[
                recipe.servings ? `${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}` : null,
                recipe.prep_time_minutes ? `${recipe.prep_time_minutes} min prep` : null,
                cost.perServing !== null && cost.total > 0 ? `≈ ${formatMoney(cost.perServing)} per serving` : null,
                cost.total > 0 && householdSize && recipe.servings
                  ? `${formatMoney(cost.total * scaleFactor(recipe.servings, householdSize))} for ${householdSize}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              {cost.missing.length > 0 && (
                <span className="pill pill-amber" style={{ marginLeft: '6px' }} title={cost.missing.join(', ')}>
                  {cost.missing.length} unpriced
                </span>
              )}
            </p>

            {(recipe.dietary_tags?.length > 0 || recipe.meal_types?.length > 0) && (
              <p style={{ margin: '0 0 8px 0' }}>
                {(recipe.meal_types ?? []).map((type) => (
                  <span key={type} className="pill pill-green">
                    {MEAL_TYPES.find((t) => t.id === type)?.label ?? type}
                  </span>
                ))}
                {(recipe.dietary_tags ?? []).map((tag) => (
                  <span key={tag} className="pill">
                    {tag}
                  </span>
                ))}
              </p>
            )}

            {recipe.ingredients_structured?.length > 0 && (
              <details style={{ marginBottom: '6px' }}>
                <summary style={{ cursor: 'pointer' }}>Ingredients</summary>
                <ul style={{ margin: '8px 0 0 20px' }}>
                  {recipe.ingredients_structured.map((ing, i) => (
                    <li key={i}>{formatIngredient(ing)}</li>
                  ))}
                </ul>
              </details>
            )}

            {recipe.instructions && (
              <details>
                <summary style={{ cursor: 'pointer' }}>Instructions</summary>
                <p style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>{recipe.instructions}</p>
              </details>
            )}
          </div>
        ))
      )}
    </div>
  );
}
