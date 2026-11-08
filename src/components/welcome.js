import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { usePriceTable } from '../hooks/usePriceTable.js';
import { getMonday, addDays, toISODate } from '../utils/dateutils.js';
import { weekShopEstimate } from '../utils/budgetUtils.js';
import { formatMoney } from '../utils/priceUtils.js';
import { readStoredFlag, SCALE_PREF_KEY } from '../utils/storage.js';

const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'];
const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

// Day 10: Welcome is now a dashboard for the current week — what the shop
// is likely to cost against your budget, how much of the week is planned,
// and what's on today — instead of just echoing the profile back.
// Log Out moved to the nav bar.
export default function Welcome({ user, profile }) {
  const { table, loading: pricesLoading } = usePriceTable(user.id);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const weekStart = getMonday(new Date());
  const weekStartISO = toISODate(weekStart);
  const weekEndISO = toISODate(addDays(weekStart, 6));
  const todayISO = toISODate(new Date());

  useEffect(() => {
    supabase
      .from('meal_plan_entries')
      .select('plan_date, meal_slot, custom_meal_name, recipe:recipes(name, servings, ingredients_structured)')
      .eq('user_id', user.id)
      .gte('plan_date', weekStartISO)
      .lte('plan_date', weekEndISO)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setEntries(data ?? []);
        setLoading(false);
      });
  }, [user.id, weekStartISO, weekEndISO]);

  const budget = Number(profile.budget) || 0;
  const estimate = weekShopEstimate(entries, table, {
    householdSize: profile.household_size,
    scale: readStoredFlag(SCALE_PREF_KEY, true),
  });
  const spentShare = budget > 0 ? Math.min(100, (estimate.total / budget) * 100) : 0;
  const over = budget > 0 && estimate.total > budget;
  const plannedCount = entries.length;
  const todays = MEAL_SLOTS.map((slot) => ({
    slot,
    entry: entries.find((e) => e.plan_date === todayISO && e.meal_slot === slot),
  }));
  const ready = !loading && !pricesLoading;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Welcome back</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Logged in as {user.email}
          </p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card">
        <div className="row">
          <strong className="grow">This week's shop</strong>
          <span className="muted small">
            Household of {profile.household_size || '?'} · {profile.preferred_supermarket}
          </span>
        </div>
        {!ready ? (
          <p className="muted">Working it out...</p>
        ) : (
          <>
            <div style={{ fontSize: '1.6rem', fontWeight: 600, marginTop: '8px' }} className="money">
              {formatMoney(estimate.total)}
              {budget > 0 && <span className="muted" style={{ fontSize: '1rem', fontWeight: 400 }}> of {formatMoney(budget)}</span>}
            </div>
            {budget > 0 && (
              <div
                className={`budget-meter ${over ? 'over' : ''}`}
                role="meter"
                aria-label="Weekly budget used"
                aria-valuemin={0}
                aria-valuemax={budget}
                aria-valuenow={Number(estimate.total.toFixed(2))}
              >
                <span style={{ width: `${spentShare}%` }} />
              </div>
            )}
            <p className="small muted" style={{ margin: 0 }}>
              {budget <= 0
                ? 'Set a weekly budget in Settings to track against it.'
                : over
                ? `${formatMoney(estimate.total - budget)} over budget.`
                : `${formatMoney(budget - estimate.total)} left to plan with.`}
              {estimate.unpriced > 0 && (
                <>
                  {' '}
                  {estimate.unpriced} item{estimate.unpriced === 1 ? '' : 's'} not priced —{' '}
                  <Link to="/prices">fix prices</Link>.
                </>
              )}
            </p>
          </>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Meals planned</div>
          <div className="stat-value">{ready ? `${plannedCount} / 21` : '–'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Per person, per day</div>
          <div className="stat-value">
            {ready && Number(profile.household_size) > 0 ? formatMoney(estimate.total / profile.household_size / 7) : '–'}
          </div>
        </div>
      </div>

      <div className="card">
        <strong>Today</strong>
        {todays.map(({ slot, entry }) => (
          <div key={slot} className="list-row">
            <span className="muted" style={{ width: '90px' }}>
              {SLOT_LABELS[slot]}
            </span>
            <span className="grow">
              {entry?.recipe?.name || entry?.custom_meal_name || <span className="muted">Nothing planned</span>}
            </span>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: '16px' }}>
        <Link to="/meal-plan">
          <button className="btn btn-primary">{plannedCount < 21 ? 'Plan this week' : 'Open meal plan'}</button>
        </Link>
        <Link to="/shopping-list">
          <button className="btn">Shopping list</button>
        </Link>
        <Link to="/recipes">
          <button className="btn">Recipes</button>
        </Link>
      </div>
    </div>
  );
}
