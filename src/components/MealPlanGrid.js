import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'];
const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatRangeLabel(start, end) {
  const startLabel = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endLabel = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

export default function MealPlanGrid({ userId, onBack }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [recipes, setRecipes] = useState([]);
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('grid'); // 'grid' | 'edit'
  const [editingCell, setEditingCell] = useState(null); // { dateISO, slot }
  const [editMode, setEditMode] = useState('recipe'); // 'recipe' | 'custom'
  const [editRecipeId, setEditRecipeId] = useState('');
  const [editCustomText, setEditCustomText] = useState('');
  const [saving, setSaving] = useState(false);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];
  const todayISO = toISODate(new Date());

  const fetchEntries = useCallback(() => {
    setLoading(true);
    return supabase
      .from('meal_plan_entries')
      .select('*, recipe:recipes(id, name)')
      .eq('user_id', userId)
      .gte('plan_date', toISODate(weekStart))
      .lte('plan_date', toISODate(weekEnd))
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
        } else {
          const map = {};
          (data ?? []).forEach((row) => {
            map[`${row.plan_date}_${row.meal_slot}`] = row;
          });
          setEntries(map);
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, toISODate(weekStart)]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    supabase
      .from('recipes')
      .select('id, name')
      .eq('user_id', userId)
      .order('name')
      .then(({ data, error }) => {
        if (!error) setRecipes(data ?? []);
      });
  }, [userId]);

  const openCell = (dateISO, slot) => {
    const existing = entries[`${dateISO}_${slot}`];
    setEditingCell({ dateISO, slot });
    setError('');
    if (existing?.recipe_id) {
      setEditMode('recipe');
      setEditRecipeId(existing.recipe_id);
      setEditCustomText('');
    } else if (existing?.custom_meal_name) {
      setEditMode('custom');
      setEditCustomText(existing.custom_meal_name);
      setEditRecipeId('');
    } else {
      setEditMode('recipe');
      setEditRecipeId('');
      setEditCustomText('');
    }
    setView('edit');
  };

  const handleSaveCell = async () => {
    if (editMode === 'recipe' && !editRecipeId) {
      setError('Pick a recipe, or switch to a custom note.');
      return;
    }
    if (editMode === 'custom' && !editCustomText.trim()) {
      setError('Enter a note, or switch to picking a recipe.');
      return;
    }

    setError('');
    setSaving(true);

    const payload = {
      user_id: userId,
      plan_date: editingCell.dateISO,
      meal_slot: editingCell.slot,
      recipe_id: editMode === 'recipe' ? editRecipeId : null,
      custom_meal_name: editMode === 'custom' ? editCustomText.trim() : null,
    };

    const { error } = await supabase
      .from('meal_plan_entries')
      .upsert(payload, { onConflict: 'user_id,plan_date,meal_slot' });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setView('grid');
    setEditingCell(null);
    fetchEntries();
  };

  const handleClearCell = async () => {
    const existing = entries[`${editingCell.dateISO}_${editingCell.slot}`];
    if (!existing) {
      setView('grid');
      setEditingCell(null);
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('meal_plan_entries').delete().eq('id', existing.id);
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setView('grid');
    setEditingCell(null);
    fetchEntries();
  };

  if (view === 'edit' && editingCell) {
    const dayLabel = formatDayLabel(new Date(editingCell.dateISO));
    return (
      <div style={{ maxWidth: '450px', margin: '50px auto' }}>
        <h2>
          {dayLabel} · {SLOT_LABELS[editingCell.slot]}
        </h2>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => setEditMode('recipe')}
            style={{
              flex: 1,
              padding: '10px',
              cursor: 'pointer',
              fontWeight: editMode === 'recipe' ? 'bold' : 'normal',
              background: editMode === 'recipe' ? '#eef' : undefined,
            }}
          >
            From Recipe Library
          </button>
          <button
            onClick={() => setEditMode('custom')}
            style={{
              flex: 1,
              padding: '10px',
              cursor: 'pointer',
              fontWeight: editMode === 'custom' ? 'bold' : 'normal',
              background: editMode === 'custom' ? '#eef' : undefined,
            }}
          >
            Custom Note
          </button>
        </div>

        {editMode === 'recipe' ? (
          <div style={{ marginBottom: '20px' }}>
            <label>Recipe</label>
            {recipes.length === 0 ? (
              <p style={{ color: '#666' }}>
                No saved recipes yet — add one in the Recipe Library, or use a custom note instead.
              </p>
            ) : (
              <select
                value={editRecipeId}
                onChange={(e) => setEditRecipeId(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              >
                <option value="">Select a recipe...</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: '20px' }}>
            <label>Note</label>
            <input
              type="text"
              value={editCustomText}
              onChange={(e) => setEditCustomText(e.target.value)}
              placeholder="e.g. leftovers, eating out"
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
        )}

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              setView('grid');
              setEditingCell(null);
            }}
            style={{ flex: 1, padding: '10px' }}
          >
            Cancel
          </button>
          <button onClick={handleClearCell} disabled={saving} style={{ flex: 1, padding: '10px' }}>
            Clear
          </button>
          <button onClick={handleSaveCell} disabled={saving} style={{ flex: 1, padding: '10px' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0 }}>Weekly Meal Plan</h2>
        <button onClick={onBack} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Back
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <button onClick={() => setWeekStart((d) => addDays(d, -7))} style={{ padding: '6px 12px', cursor: 'pointer' }}>
          ← Prev Week
        </button>
        <div style={{ minWidth: '200px', textAlign: 'center' }}>
          <strong>{formatRangeLabel(weekStart, weekEnd)}</strong>
          <br />
          <button
            onClick={() => setWeekStart(getMonday(new Date()))}
            style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px' }}
          >
            This Week
          </button>
        </div>
        <button onClick={() => setWeekStart((d) => addDays(d, 7))} style={{ padding: '6px 12px', cursor: 'pointer' }}>
          Next Week →
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {loading ? (
        <p>Loading meal plan...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Day</th>
              {MEAL_SLOTS.map((slot) => (
                <th key={slot} style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                  {SLOT_LABELS[slot]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const dateISO = toISODate(day);
              const isToday = dateISO === todayISO;
              return (
                <tr key={dateISO} style={{ background: isToday ? '#fffbe6' : undefined }}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #eee', fontWeight: isToday ? 'bold' : 'normal' }}>
                    {formatDayLabel(day)}
                  </td>
                  {MEAL_SLOTS.map((slot) => {
                    const entry = entries[`${dateISO}_${slot}`];
                    const label = entry?.recipe?.name || entry?.custom_meal_name;
                    return (
                      <td
                        key={slot}
                        onClick={() => openCell(dateISO, slot)}
                        style={{
                          padding: '8px',
                          borderBottom: '1px solid #eee',
                          borderLeft: '1px solid #eee',
                          cursor: 'pointer',
                          color: label ? 'inherit' : '#aaa',
                          fontStyle: entry?.custom_meal_name && !entry?.recipe ? 'italic' : 'normal',
                        }}
                      >
                        {label || '+ Add'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
