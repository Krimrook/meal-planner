import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { addDays, toISODate, formatDayLabel, formatRangeLabel, weekStartFromParam, getMonday, readStoredWeek, writeStoredWeek } from '../utils/dateutils.js';
import { groupsToSections, addToGroups } from '../utils/shoppinglistutils.js';
import { AISLES } from '../utils/constants.js';

const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const WEEK_STORAGE_KEY = 'shoppingListWeek';

export default function ShoppingList({ userId }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [weekStart, setWeekStartState] = useState(() =>
    weekStartFromParam(searchParams.get('week') || readStoredWeek(WEEK_STORAGE_KEY))
  );
  // The raw name+unit groups, kept in state (rather than the finished list) so
  // that changing an aisle can re-sort the list instantly without refetching.
  const [groups, setGroups] = useState({});
  // The user's own aisle corrections: { 'ingredient name in lowercase': 'Aisle' }
  const [aisleOverrides, setAisleOverrides] = useState({});
  const [editingAisles, setEditingAisles] = useState(false);
  const [otherMeals, setOtherMeals] = useState([]); // custom-note entries with no recipe ingredients
  const [checkedItems, setCheckedItems] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Keeps the URL's ?week= in sync with whichever week is showing, so the
  // Shopping List is bookmarkable and the browser back/forward buttons step
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

  const weekEnd = addDays(weekStart, 6);
  const weekStartISO = toISODate(weekStart);
  const weekEndISO = toISODate(weekEnd);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError('');

    return Promise.all([
      supabase
        .from('meal_plan_entries')
        .select('plan_date, meal_slot, custom_meal_name, recipe:recipes(name, ingredients_structured)')
        .eq('user_id', userId)
        .gte('plan_date', weekStartISO)
        .lte('plan_date', weekEndISO),
      supabase
        .from('shopping_list_checked_items')
        .select('item_text')
        .eq('user_id', userId)
        .eq('week_start_date', weekStartISO),
      supabase.from('ingredient_aisles').select('ingredient_name, aisle').eq('user_id', userId),
    ]).then(([entriesRes, checkedRes, aislesRes]) => {
      if (entriesRes.error) {
        setError(entriesRes.error.message);
        setLoading(false);
        return;
      }
      if (checkedRes.error) {
        setError(checkedRes.error.message);
        setLoading(false);
        return;
      }

      // Unlike the two queries above, a failure here isn't fatal: the list is
      // still usable with guessed aisles, so show the error and carry on.
      const overrides = {};
      if (aislesRes.error) {
        setError(`Couldn't load your saved aisles: ${aislesRes.error.message}`);
      } else {
        (aislesRes.data ?? []).forEach((row) => {
          overrides[row.ingredient_name] = row.aisle;
        });
      }

      const nextGroups = {};
      const others = [];

      (entriesRes.data ?? []).forEach((entry) => {
        const structured = entry.recipe?.ingredients_structured;

        if (structured?.length > 0) {
          structured.forEach((ing) => addToGroups(nextGroups, ing.name, ing.unit, ing.quantity));
        } else if (entry.custom_meal_name) {
          others.push(entry);
        }
      });

      others.sort((a, b) => a.plan_date.localeCompare(b.plan_date));

      setGroups(nextGroups);
      setAisleOverrides(overrides);
      setOtherMeals(others);
      setCheckedItems(new Set((checkedRes.data ?? []).map((r) => r.item_text)));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, weekStartISO, weekEndISO]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const toggleItem = async (itemKey) => {
    const isChecked = checkedItems.has(itemKey);

    // Optimistic update
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (isChecked) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });

    if (isChecked) {
      const { error } = await supabase
        .from('shopping_list_checked_items')
        .delete()
        .eq('user_id', userId)
        .eq('week_start_date', weekStartISO)
        .eq('item_text', itemKey);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase
        .from('shopping_list_checked_items')
        .upsert(
          { user_id: userId, week_start_date: weekStartISO, item_text: itemKey },
          { onConflict: 'user_id,week_start_date,item_text' }
        );
      if (error) setError(error.message);
    }
  };

  // Saves "this ingredient belongs in this aisle" for the user. Keyed by the
  // lowercased ingredient name only (not the unit, not the week), so one
  // correction applies to every recipe and every week from then on.
  const changeAisle = async (itemName, aisle) => {
    const ingredientName = itemName.toLowerCase();

    // Optimistic update — the item jumps to its new section straight away
    setAisleOverrides((prev) => ({ ...prev, [ingredientName]: aisle }));

    const { error } = await supabase
      .from('ingredient_aisles')
      .upsert(
        { user_id: userId, ingredient_name: ingredientName, aisle },
        { onConflict: 'user_id,ingredient_name' }
      );
    if (error) setError(error.message);
  };

  // Derived on every render from the two pieces of state it depends on,
  // rather than stored in state itself — so it can never get out of sync.
  const sections = groupsToSections(groups, aisleOverrides);

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0 }}>Shopping List</h2>
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
        <p>Building shopping list...</p>
      ) : sections.length === 0 && otherMeals.length === 0 ? (
        <p style={{ color: '#666', textAlign: 'center' }}>
          No recipes planned for this week yet — add some in the Meal Plan first.
        </p>
      ) : (
        <>
          {sections.length > 0 && (
            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setEditingAisles((on) => !on)} style={{ padding: '6px 12px', cursor: 'pointer' }}>
                {editingAisles ? 'Done' : 'Edit aisles'}
              </button>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.aisle} style={{ textAlign: 'left', marginBottom: '20px' }}>
              <h3 style={{ margin: '10px 0 4px', fontSize: '15px', color: '#444' }}>{section.aisle}</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {section.items.map((item) => {
                  const checked = checkedItems.has(item.key);
                  return (
                    <li
                      key={item.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(item.key)}
                        style={{ marginRight: '10px', cursor: 'pointer' }}
                      />
                      <span
                        style={{
                          textDecoration: checked ? 'line-through' : 'none',
                          color: checked ? '#999' : 'inherit',
                          flex: 1,
                        }}
                      >
                        {item.label}
                      </span>
                      {item.showCount && (
                        <span style={{ color: '#666', fontSize: '13px', marginLeft: '8px' }}>×{item.count}</span>
                      )}
                      {editingAisles && (
                        <select
                          aria-label={`Aisle for ${item.name}`}
                          value={item.aisle}
                          onChange={(e) => changeAisle(item.name, e.target.value)}
                          style={{ marginLeft: '8px' }}
                        >
                          {AISLES.map((aisle) => (
                            <option key={aisle} value={aisle}>
                              {aisle}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {otherMeals.length > 0 && (
            <div style={{ marginTop: '25px', textAlign: 'left' }}>
              <p style={{ color: '#666', marginBottom: '8px' }}>Other planned meals (no ingredients to list):</p>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
                {otherMeals.map((entry, i) => (
                  <li key={i}>
                    {formatDayLabel(new Date(entry.plan_date))} · {SLOT_LABELS[entry.meal_slot]} — {entry.custom_meal_name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}