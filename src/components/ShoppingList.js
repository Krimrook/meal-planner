import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

export default function ShoppingList({ userId, onBack }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [items, setItems] = useState([]); // [{ text, count }]
  const [otherMeals, setOtherMeals] = useState([]); // custom-note entries with no recipe ingredients
  const [checkedItems, setCheckedItems] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const weekEnd = addDays(weekStart, 6);
  const weekStartISO = toISODate(weekStart);
  const weekEndISO = toISODate(weekEnd);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError('');

    return Promise.all([
      supabase
        .from('meal_plan_entries')
        .select('plan_date, meal_slot, custom_meal_name, recipe:recipes(name, ingredients)')
        .eq('user_id', userId)
        .gte('plan_date', weekStartISO)
        .lte('plan_date', weekEndISO),
      supabase
        .from('shopping_list_checked_items')
        .select('item_text')
        .eq('user_id', userId)
        .eq('week_start_date', weekStartISO),
    ]).then(([entriesRes, checkedRes]) => {
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

      const counts = {};
      const others = [];

      (entriesRes.data ?? []).forEach((entry) => {
        if (entry.recipe?.ingredients?.length > 0) {
          entry.recipe.ingredients.forEach((line) => {
            counts[line] = (counts[line] || 0) + 1;
          });
        } else if (entry.custom_meal_name) {
          others.push(entry);
        }
      });

      const sortedItems = Object.keys(counts)
        .sort((a, b) => a.localeCompare(b))
        .map((text) => ({ text, count: counts[text] }));

      others.sort((a, b) => a.plan_date.localeCompare(b.plan_date));

      setItems(sortedItems);
      setOtherMeals(others);
      setCheckedItems(new Set((checkedRes.data ?? []).map((r) => r.item_text)));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, weekStartISO, weekEndISO]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const toggleItem = async (itemText) => {
    const isChecked = checkedItems.has(itemText);

    // Optimistic update
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (isChecked) next.delete(itemText);
      else next.add(itemText);
      return next;
    });

    if (isChecked) {
      const { error } = await supabase
        .from('shopping_list_checked_items')
        .delete()
        .eq('user_id', userId)
        .eq('week_start_date', weekStartISO)
        .eq('item_text', itemText);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase
        .from('shopping_list_checked_items')
        .upsert(
          { user_id: userId, week_start_date: weekStartISO, item_text: itemText },
          { onConflict: 'user_id,week_start_date,item_text' }
        );
      if (error) setError(error.message);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0 }}>Shopping List</h2>
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
        <p>Building shopping list...</p>
      ) : items.length === 0 && otherMeals.length === 0 ? (
        <p style={{ color: '#666', textAlign: 'center' }}>
          No recipes planned for this week yet — add some in the Meal Plan first.
        </p>
      ) : (
        <>
          {items.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left' }}>
              {items.map((item) => {
                const checked = checkedItems.has(item.text);
                return (
                  <li
                    key={item.text}
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
                      onChange={() => toggleItem(item.text)}
                      style={{ marginRight: '10px', cursor: 'pointer' }}
                    />
                    <span
                      style={{
                        textDecoration: checked ? 'line-through' : 'none',
                        color: checked ? '#999' : 'inherit',
                        flex: 1,
                      }}
                    >
                      {item.text}
                    </span>
                    {item.count > 1 && (
                      <span style={{ color: '#666', fontSize: '13px', marginLeft: '8px' }}>×{item.count}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

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
