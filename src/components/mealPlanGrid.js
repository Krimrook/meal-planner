import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getMonday, addDays, toISODate, formatDayLabel, formatRangeLabel, weekStartFromParam, readStoredWeek, writeStoredWeek } from '../utils/dateutils.js';
import { COMMON_MEAL_NOTES } from '../utils/constants';

const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'];
const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const WEEK_STORAGE_KEY = 'mealPlanWeek';

export default function MealPlanGrid({ userId }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [weekStart, setWeekStartState] = useState(() =>
  weekStartFromParam(searchParams.get('week') || readStoredWeek(WEEK_STORAGE_KEY))
);
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
  // Set only when Next/Previous has to cross into an adjacent week: holds the
  // slot to open automatically once that week's entries finish loading, since
  // fetchEntries is async and the target slot's saved data (if any) isn't
  // available until it resolves.
  const [pendingOpenSlot, setPendingOpenSlot] = useState(null);

  // Keeps the URL's ?week= in sync with whichever week is showing, so the
  // Meal Plan is bookmarkable and the browser back/forward buttons step
  // through weeks instead of just losing the state entirely.
  const setWeekStart = (updater) => {
  setWeekStartState((prev) => {
    const next = typeof updater === 'function' ? updater(prev) : updater;
    const iso = toISODate(next);
    setSearchParams({ week: iso }, { replace: true });
    writeStoredWeek(WEEK_STORAGE_KEY, iso);
    return next;
  });
};

// If we landed here without a ?week= param (e.g. via the NavBar, or the
// Welcome screen's Back button) but have a remembered week from a
// previous visit, backfill the URL so it's bookmarkable immediately.
useEffect(() => {
  if (!searchParams.get('week')) {
    setSearchParams({ week: toISODate(weekStart) }, { replace: true });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];
  const todayISO = toISODate(new Date());

  // Every slot in the currently displayed week, in the order a user would
  // naturally step through them: Mon breakfast, Mon lunch, Mon dinner, Tue
  // breakfast, ... This is what Previous/Next walk along.
  const flatSlots = days.flatMap((day) => {
    const dateISO = toISODate(day);
    return MEAL_SLOTS.map((slot) => ({ dateISO, slot }));
  });

  const currentIndex = editingCell
    ? flatSlots.findIndex((s) => s.dateISO === editingCell.dateISO && s.slot === editingCell.slot)
    : -1;

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

  // Once a week-crossing Next/Previous finishes loading the new week's
  // entries, open whichever slot was requested (Monday breakfast when moving
  // forward, Sunday dinner when moving back) using the now-fresh data.
  useEffect(() => {
    if (!loading && pendingOpenSlot) {
      openCell(pendingOpenSlot.dateISO, pendingOpenSlot.slot);
      setPendingOpenSlot(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pendingOpenSlot]);

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

  // Used by Previous/Next: saves the slot currently being edited only if
  // something's actually been entered for it, so stepping through empty
  // slots doesn't force a choice on every one — you can skip past a slot you
  // don't want to plan yet, the same way "+ Add" on the grid works. Unlike
  // handleSaveCell above, this never blocks navigation with a validation
  // error, since an empty slot is a valid "nothing planned yet" state here.
  const saveCurrentIfFilled = async () => {
    if (!editingCell) return true;

    const hasRecipe = editMode === 'recipe' && editRecipeId;
    const hasCustom = editMode === 'custom' && editCustomText.trim();
    if (!hasRecipe && !hasCustom) {
      return true;
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
      return false;
    }

    fetchEntries();
    return true;
  };

  // Moves the edit view to the previous (-1) or next (+1) slot in sequence —
  // this is what lets you go breakfast -> lunch -> dinner -> next day's
  // breakfast without dropping back to the grid in between. At either end of
  // the currently-loaded week it rolls into the adjacent week automatically.
  const goToRelativeSlot = async (delta) => {
    const ok = await saveCurrentIfFilled();
    if (!ok) return;

    const nextIndex = currentIndex + delta;

    if (nextIndex >= 0 && nextIndex < flatSlots.length) {
      const target = flatSlots[nextIndex];
      openCell(target.dateISO, target.slot);
      return;
    }

    // Ran off the edge of the week — roll into the adjacent week and open
    // its first (Monday breakfast) or last (Sunday dinner) slot once that
    // week's entries have loaded (handled by the pendingOpenSlot effect).
    const newWeekStart = addDays(weekStart, delta > 0 ? 7 : -7);
    const targetSlot =
      delta > 0
        ? { dateISO: toISODate(newWeekStart), slot: 'breakfast' }
        : { dateISO: toISODate(addDays(newWeekStart, 6)), slot: 'dinner' };

    setPendingOpenSlot(targetSlot);
    setWeekStart(newWeekStart);
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
    // Waiting on the adjacent week's entries to load before we can show the
    // target slot pre-filled with its saved data (if any).
    if (pendingOpenSlot) {
      return (
        <div style={{ maxWidth: '450px', margin: '50px auto', textAlign: 'center' }}>
          <p style={{ color: '#666' }}>Loading...</p>
        </div>
      );
    }

    const dayLabel = formatDayLabel(new Date(editingCell.dateISO));
    const isFirstSlot = currentIndex === 0;
    const isLastSlot = currentIndex === flatSlots.length - 1;

    return (
      <div style={{ maxWidth: '450px', margin: '50px auto' }}>
        <h2 style={{ marginBottom: '4px' }}>
          {dayLabel} · {SLOT_LABELS[editingCell.slot]}
        </h2>
        {currentIndex !== -1 && (
          <p style={{ color: '#666', fontSize: '13px', marginTop: 0 }}>
            Slot {currentIndex + 1} of {flatSlots.length} this week
          </p>
        )}

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
              list="meal-note-suggestions"
              type="text"
              value={editCustomText}
              onChange={(e) => setEditCustomText(e.target.value)}
              placeholder="e.g. leftovers, eating out"
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
            <datalist id="meal-note-suggestions">
              {COMMON_MEAL_NOTES.map((note) => (
                <option key={note} value={note} />
              ))}
            </datalist>
          </div>
        )}

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
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
            {saving ? 'Saving...' : 'Save & Close'}
          </button>
        </div>

        {/* The step-through-the-week controls: saves the current slot only if
            something's filled in, then moves on. This is the "breakfast ->
            lunch -> dinner -> next day's breakfast" flow. */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => goToRelativeSlot(-1)}
            disabled={saving}
            style={{ flex: 1, padding: '10px' }}
          >
            {isFirstSlot ? '← Prev Week' : '← Previous'}
          </button>
          <button
            onClick={() => goToRelativeSlot(1)}
            disabled={saving}
            style={{ flex: 1, padding: '10px', fontWeight: 'bold', background: '#eef' }}
          >
            {isLastSlot ? 'Next Week →' : 'Next →'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0 }}>Weekly Meal Plan</h2>
        <button onClick={() => navigate('/')} style={{ padding: '8px 16px', cursor: 'pointer' }}>
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