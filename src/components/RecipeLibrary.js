import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Low-Carb', 'High-Protein'];

// Recognized unit words, used only to pre-fill the structured form when opening
// an old recipe that still has free-text ingredient lines (see parseLegacyIngredientLine).
const UNIT_WORDS = [
  'g', 'kg', 'mg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'cups', 'oz', 'lb', 'lbs',
  'clove', 'cloves', 'can', 'cans', 'slice', 'slices', 'piece', 'pieces',
  'pinch', 'pinches', 'bunch', 'bunches', 'stick', 'sticks',
];

const emptyIngredientRow = () => ({ name: '', quantity: '', unit: '' });

const emptyForm = {
  name: '',
  servings: '',
  prepTimeMinutes: '',
  ingredients: [emptyIngredientRow()],
  instructions: '',
  dietaryTags: [],
};

// Best-effort split of an old free-text ingredient line into { name, quantity, unit }.
// Only used to pre-fill the edit form for recipes saved before this change — the user
// reviews/corrects the result in the UI before it's ever saved back structured.
function parseLegacyIngredientLine(line) {
  const match = line.match(/^\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s*(.*)$/);
  if (match) {
    const [, qty, maybeUnit, rest] = match;
    if (maybeUnit && UNIT_WORDS.includes(maybeUnit.toLowerCase())) {
      return { name: rest.trim(), quantity: qty, unit: maybeUnit.toLowerCase() };
    }
    const name = [maybeUnit, rest].filter(Boolean).join(' ').trim();
    return { name: name || line.trim(), quantity: qty, unit: '' };
  }
  return { name: line.trim(), quantity: '', unit: '' };
}

function formatIngredient(ing) {
  const parts = [];
  if (ing.quantity !== null && ing.quantity !== undefined && ing.quantity !== '') parts.push(ing.quantity);
  if (ing.unit) parts.push(ing.unit);
  parts.push(ing.name);
  return parts.join(' ');
}

export default function RecipeLibrary({ userId, onBack }) {
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
        else setRecipes(data);
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
    let ingredientRows;
    if (recipe.ingredients_structured?.length > 0) {
      ingredientRows = recipe.ingredients_structured.map((ing) => ({
        name: ing.name ?? '',
        quantity: ing.quantity !== null && ing.quantity !== undefined ? String(ing.quantity) : '',
        unit: ing.unit ?? '',
      }));
    } else if (recipe.ingredients?.length > 0) {
      // Legacy free-text recipe, never migrated — pre-fill best-effort, user reviews before saving.
      ingredientRows = recipe.ingredients.map(parseLegacyIngredientLine);
    } else {
      ingredientRows = [emptyIngredientRow()];
    }

    setForm({
      name: recipe.name,
      servings: recipe.servings ?? '',
      prepTimeMinutes: recipe.prep_time_minutes ?? '',
      ingredients: ingredientRows,
      instructions: recipe.instructions ?? '',
      dietaryTags: recipe.dietary_tags ?? [],
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
      ingredients: [], // clear legacy column now that this recipe is saved in the new structured format
      instructions: form.instructions.trim(),
      dietary_tags: form.dietaryTags,
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

  if (view === 'form') {
    return (
      <div style={{ maxWidth: '500px', margin: '50px auto' }}>
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
            "1 onion" or "salt to taste".
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
                type="text"
                placeholder="Unit (g, cups...)"
                value={row.unit}
                onChange={(e) => updateIngredientRow(i, 'unit', e.target.value)}
                style={{ width: '120px', padding: '8px' }}
              />
              <input
                type="text"
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
          <button
            type="button"
            onClick={addIngredientRow}
            style={{ marginTop: '10px', padding: '6px 12px', cursor: 'pointer' }}
          >
            + Add Ingredient
          </button>
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

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>My Recipes</h2>
        <button onClick={startAdd} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          + Add Recipe
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {loading ? (
        <p>Loading recipes...</p>
      ) : recipes.length === 0 ? (
        <p style={{ color: '#666' }}>No recipes yet. Add your first one above.</p>
      ) : (
        recipes.map((recipe) => (
          <div
            key={recipe.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '12px',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: '0 0 8px 0' }}>{recipe.name}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => startEdit(recipe)} style={{ padding: '4px 10px', cursor: 'pointer' }}>
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(recipe.id)}
                  style={{
                    padding: '4px 10px',
                    cursor: 'pointer',
                    color: confirmDeleteId === recipe.id ? 'white' : 'inherit',
                    background: confirmDeleteId === recipe.id ? '#c0392b' : undefined,
                  }}
                >
                  {confirmDeleteId === recipe.id ? 'Confirm?' : 'Delete'}
                </button>
              </div>
            </div>

            <p style={{ color: '#666', margin: '0 0 8px 0', fontSize: '14px' }}>
              {recipe.servings ? `${recipe.servings} servings` : ''}
              {recipe.servings && recipe.prep_time_minutes ? ' · ' : ''}
              {recipe.prep_time_minutes ? `${recipe.prep_time_minutes} min prep` : ''}
            </p>

            {recipe.dietary_tags?.length > 0 && (
              <p style={{ margin: '0 0 8px 0' }}>
                {recipe.dietary_tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: 'inline-block',
                      background: '#eef',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      marginRight: '6px',
                      fontSize: '12px',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </p>
            )}

            {recipe.ingredients_structured?.length > 0 ? (
              <details style={{ marginBottom: '6px' }}>
                <summary style={{ cursor: 'pointer' }}>Ingredients</summary>
                <ul style={{ margin: '8px 0 0 20px' }}>
                  {recipe.ingredients_structured.map((ing, i) => (
                    <li key={i}>{formatIngredient(ing)}</li>
                  ))}
                </ul>
              </details>
            ) : recipe.ingredients?.length > 0 ? (
              <details style={{ marginBottom: '6px' }}>
                <summary style={{ cursor: 'pointer' }}>
                  Ingredients <span style={{ color: '#c0392b', fontSize: '12px' }}>(needs migration — edit &amp; save to convert)</span>
                </summary>
                <ul style={{ margin: '8px 0 0 20px' }}>
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i}>{ing}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            {recipe.instructions && (
              <details>
                <summary style={{ cursor: 'pointer' }}>Instructions</summary>
                <p style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>{recipe.instructions}</p>
              </details>
            )}
          </div>
        ))
      )}

      <button onClick={onBack} style={{ padding: '10px 20px', cursor: 'pointer', marginTop: '10px' }}>
        Back
      </button>
    </div>
  );
}