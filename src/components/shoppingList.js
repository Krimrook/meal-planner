import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  addDays,
  toISODate,
  formatDayLabel,
  formatRangeLabel,
  weekStartFromParam,
  getMonday,
  readStoredWeek,
  writeStoredWeek,
  parseISODate,
} from '../utils/dateutils.js';
import { groupsToSections, groupsToItems } from '../utils/shoppinglistutils.js';
import { buildWeekGroups, costItems } from '../utils/budgetUtils.js';
import { formatMoney, describePrice } from '../utils/priceUtils.js';
import { readStoredFlag, writeStoredFlag, SCALE_PREF_KEY } from '../utils/storage.js';
import { usePriceTable } from '../hooks/usePriceTable.js';
import { AISLES } from '../utils/constants.js';

const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const WEEK_STORAGE_KEY = 'shoppingListWeek';

export default function ShoppingList({ userId, profile }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [weekStart, setWeekStartState] = useState(() =>
    weekStartFromParam(searchParams.get('week') || readStoredWeek(WEEK_STORAGE_KEY))
  );
  // Raw meal plan rows for the week. Groups are derived from these at render
  // (Day 10), so flipping "scale to household" re-sums instantly, no refetch.
  const [entries, setEntries] = useState([]);
  // The user's own aisle corrections: { 'ingredient name in lowercase': 'Aisle' }
  const [aisleOverrides, setAisleOverrides] = useState({});
  const [editingAisles, setEditingAisles] = useState(false);
  const [checkedItems, setCheckedItems] = useState(new Set());
  const [scale, setScaleState] = useState(() => readStoredFlag(SCALE_PREF_KEY, true));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { table: priceTable, error: priceError } = usePriceTable(userId);

  const householdSize = Number(profile?.household_size) || null;
  const budget = Number(profile?.budget) || 0;

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

  const setScale = (value) => {
    setScaleState(value);
    writeStoredFlag(SCALE_PREF_KEY, value);
  };

  // If we landed here without a ?week= param (e.g. via the NavBar) but have a
  // remembered week from a previous visit, backfill the URL so it's
  // bookmarkable immediately.
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
        .select('plan_date, meal_slot, custom_meal_name, recipe:recipes(name, servings, ingredients_structured)')
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

      setEntries(entriesRes.data ?? []);
      setAisleOverrides(overrides);
      setCheckedItems(new Set((checkedRes.data ?? []).map((r) => r.item_text)));
      setLoading(false);
    });
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
  // lowercased ingredient name only, so one correction applies everywhere.
  const changeAisle = async (itemName, aisle) => {
    const ingredientName = itemName.toLowerCase();
    const previous = aisleOverrides[ingredientName];

    setAisleOverrides((prev) => ({ ...prev, [ingredientName]: aisle }));

    const { error } = await supabase
      .from('ingredient_aisles')
      .upsert({ user_id: userId, ingredient_name: ingredientName, aisle }, { onConflict: 'user_id,ingredient_name' });
    if (error) {
      setError(error.message);
      // Day 10: undo the optimistic move if the save failed, instead of
      // leaving the item somewhere that'll change back on refresh.
      setAisleOverrides((prev) => restore(prev, ingredientName, previous));
    }
  };

  // Day 10: "reset to guess" — deletes the correction so guessAisle() decides again.
  const resetAisle = async (itemName) => {
    const ingredientName = itemName.toLowerCase();
    const previous = aisleOverrides[ingredientName];

    setAisleOverrides((prev) => restore(prev, ingredientName, undefined));

    const { error } = await supabase
      .from('ingredient_aisles')
      .delete()
      .eq('user_id', userId)
      .eq('ingredient_name', ingredientName);
    if (error) {
      setError(error.message);
      setAisleOverrides((prev) => restore(prev, ingredientName, previous));
    }
  };

  // Everything below is derived on each render from state, so it can never
  // drift out of sync with it.
  const { groups, otherMeals } = buildWeekGroups(entries, { householdSize, scale });
  const sections = groupsToSections(groups, aisleOverrides);
  const estimate = costItems(groupsToItems(groups), priceTable);
  const over = budget > 0 && estimate.total > budget;
  const checkedTotal = sections
    .flatMap((s) => s.items)
    .filter((item) => checkedItems.has(item.key))
    .reduce((sum, item) => {
      const c = estimate.costs[item.key];
      return c?.status === 'priced' && !c.pantry ? sum + c.cost : sum;
    }, 0);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Shopping List</h2>
      </div>

      <div className="row" style={{ justifyContent: 'center', marginBottom: '16px' }}>
        <button className="btn" onClick={() => setWeekStart((d) => addDays(d, -7))}>
          ← Prev Week
        </button>
        <div style={{ minWidth: '200px', textAlign: 'center' }}>
          <strong>{formatRangeLabel(weekStart, weekEnd)}</strong>
          <br />
          <button className="btn-link small" onClick={() => setWeekStart(getMonday(new Date()))}>
            This Week
          </button>
        </div>
        <button className="btn" onClick={() => setWeekStart((d) => addDays(d, 7))}>
          Next Week →
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {priceError && <p className="error small">{priceError}</p>}

      {loading ? (
        <p>Building shopping list...</p>
      ) : sections.length === 0 && otherMeals.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center' }}>
          No recipes planned for this week yet — add some in the <Link to="/meal-plan">Meal Plan</Link> first.
        </p>
      ) : (
        <>
          {sections.length > 0 && (
            <div className="card">
              <div className="row">
                <div className="grow">
                  <div className="muted small">Estimated shop</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 600 }} className="money">
                    {estimate.approx ? '≈ ' : ''}
                    {formatMoney(estimate.total)}
                    {budget > 0 && (
                      <span className="muted" style={{ fontSize: '0.95rem', fontWeight: 400 }}>
                        {' '}
                        of {formatMoney(budget)}
                      </span>
                    )}
                  </div>
                </div>
                {checkedTotal > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div className="muted small">In trolley</div>
                    <div className="money" style={{ fontWeight: 600 }}>
                      {formatMoney(checkedTotal)}
                    </div>
                  </div>
                )}
              </div>
              {budget > 0 && (
                <div className={`budget-meter ${over ? 'over' : ''}`}>
                  <span style={{ width: `${Math.min(100, (estimate.total / budget) * 100)}%` }} />
                </div>
              )}
              <p className="small muted" style={{ margin: '6px 0 0' }}>
                Whole packs, rounded up.
                {estimate.pantryTotal > 0 && ` Pantry staples (${formatMoney(estimate.pantryTotal)} if you're out) not included.`}
                {estimate.unpriced > 0 && (
                  <>
                    {' '}
                    {estimate.unpriced} item{estimate.unpriced === 1 ? '' : 's'} not priced —{' '}
                    <Link to="/prices">fix on Prices</Link>.
                  </>
                )}
              </p>
            </div>
          )}

          {sections.length > 0 && (
            <div className="row" style={{ justifyContent: 'space-between', margin: '8px 0' }}>
              <label className="small">
                <input
                  type="checkbox"
                  checked={scale}
                  onChange={(e) => setScale(e.target.checked)}
                  disabled={!householdSize}
                  style={{ marginRight: '6px' }}
                />
                Scale recipes to household of {householdSize || '?'}
              </label>
              <button className="btn" onClick={() => setEditingAisles((on) => !on)}>
                {editingAisles ? 'Done' : 'Edit aisles'}
              </button>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.aisle} className="card" style={{ padding: '10px 16px' }}>
              <h3 style={{ margin: '4px 0', fontSize: '15px', color: 'var(--muted)' }}>{section.aisle}</h3>
              {section.items.map((item) => {
                const checked = checkedItems.has(item.key);
                const cost = estimate.costs[item.key];
                const hasOverride = aisleOverrides[item.name.toLowerCase()] !== undefined;
                return (
                  <div key={item.key} className="list-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(item.key)}
                      aria-label={`Got ${item.label}`}
                      style={{ cursor: 'pointer' }}
                    />
                    <span
                      className="grow"
                      style={{
                        textDecoration: checked ? 'line-through' : 'none',
                        color: checked ? '#999' : 'inherit',
                      }}
                    >
                      {item.label}
                      {item.showCount && <span className="muted small"> ×{item.count}</span>}
                    </span>
                    {!editingAisles && <ItemCost cost={cost} />}
                    {editingAisles && (
                      <>
                        <select
                          aria-label={`Aisle for ${item.name}`}
                          value={item.aisle}
                          onChange={(e) => changeAisle(item.name, e.target.value)}
                          style={{ padding: '4px' }}
                        >
                          {AISLES.map((aisle) => (
                            <option key={aisle} value={aisle}>
                              {aisle}
                            </option>
                          ))}
                        </select>
                        {hasOverride && (
                          <button
                            className="btn-link small"
                            onClick={() => resetAisle(item.name)}
                            title="Forget your correction and go back to the automatic guess"
                          >
                            reset
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {otherMeals.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <p className="muted" style={{ marginBottom: '8px' }}>
                Other planned meals (no ingredients to list):
              </p>
              <ul className="muted" style={{ margin: 0, paddingLeft: '20px' }}>
                {otherMeals.map((entry, i) => (
                  <li key={i}>
                    {formatDayLabel(parseISODate(entry.plan_date))} · {SLOT_LABELS[entry.meal_slot]} —{' '}
                    {entry.custom_meal_name}
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

function ItemCost({ cost }) {
  if (!cost || cost.status === 'no-price') {
    return <span className="pill pill-amber">no price</span>;
  }
  if (cost.status === 'unit-mismatch') {
    return (
      <span className="pill pill-amber" title="The recipe's unit can't be converted to the price's unit">
        check unit
      </span>
    );
  }
  const shared = cost.combinedLines > 1;
  return (
    <span
      className={`money small ${cost.pantry ? 'muted' : ''}`}
      title={`${cost.packs} × ${describePrice(cost.price)}${cost.source === 'default' ? ' (starter price)' : ''}${
        shared ? ' — shared with another line for the same ingredient' : ''
      }`}
    >
      {cost.pantry ? 'pantry' : `${cost.approx ? '≈' : ''}${formatMoney(cost.cost)}`}
      {!cost.pantry && !shared && cost.packs > 1 && <span className="muted"> ({cost.packs} packs)</span>}
    </span>
  );
}

function restore(map, key, value) {
  const next = { ...map };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}
