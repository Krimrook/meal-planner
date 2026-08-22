import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

// Parses the ?week= param into a valid Monday, falling back to the current
// week for anything missing or malformed (e.g. a hand-edited URL).
function weekStartFromParam(param) {
  if (param) {
    const parsed = new Date(param);
    if (!Number.isNaN(parsed.getTime())) {
      return getMonday(parsed);
    }
  }
  return getMonday(new Date());
}

const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

// Rounds to 2dp and strips trailing zeros so summed quantities don't show as
// 0.30000000000000004 (classic floating point addition artifact).
function trimNumber(n) {
  return Number(n.toFixed(2)).toString();
}

// Folds one ingredient occurrence into the running groups map. Ingredients are grouped
// by name+unit (case-insensitive) so "200g chicken breast" x2 becomes one 400g line.
// Ingredients with no quantity (or from recipes not yet migrated to structured
// ingredients) still get grouped by name, just without a numeric total — they fall
// back to the old "name ×N" display.
function addToGroups(groups, rawName, rawUnit, rawQuantity) {
  const name = (rawName || '').trim();
  if (!name) return;
  const unit = (rawUnit || '').trim();
  const key = `${name.toLowerCase()}|${unit.toLowerCase()}`;

  if (!groups[key]) {
    groups[key] = { key, name, unit, totalQty: 0, hasQty: false, count: 0 };
  }
  groups[key].count += 1;

  const qty = rawQuantity !== null && rawQuantity !== undefined && rawQuantity !== '' ? Number(rawQuantity) : null;
  if (qty !== null && !Number.isNaN(qty)) {
    groups[key].totalQty += qty;
    groups[key].hasQty = true;
  }
}

export default function ShoppingList({ userId }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [weekStart, setWeekStartState] = useState(() => weekStartFromParam(searchParams.get('week')));
  const [items, setItems] = useState([]); // [{ key, label, count, showCount }]
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
      setSearchParams({ week: toISODate(next) }, { replace: true });
      return next;
    });
  };

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

      const groups = {};
      const others = [];

      (entriesRes.data ?? []).forEach((entry) => {
        const structured = entry.recipe?.ingredients_structured;

        if (structured?.length > 0) {
          structured.forEach((ing) => addToGroups(groups, ing.name, ing.unit, ing.quantity));
        } else if (entry.custom_meal_name) {
          others.push(entry);
        }
      });

      const sortedItems = Object.values(groups)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((g) => ({
          key: g.key,
          label: g.hasQty ? `${trimNumber(g.totalQty)}${g.unit ? ' ' + g.unit : ''} ${g.name}` : g.name,
          count: g.count,
          showCount: !g.hasQty && g.count > 1,
        }));

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
      ) : items.length === 0 && otherMeals.length === 0 ? (
        <p style={{ color: '#666', textAlign: 'center' }}>
          No recipes planned for this week yet — add some in the Meal Plan first.
        </p>
      ) : (
        <>
          {items.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, textAlign: 'left' }}>
              {items.map((item) => {
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