import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DIETARY_OPTIONS, SUPERMARKETS } from '../utils/constants';

export default function Settings({ userId, profile, onSave }) {
  const navigate = useNavigate();
  const [budget, setBudget] = useState('');
  const [householdSize, setHouseholdSize] = useState('');
  const [dietaryPreferences, setDietaryPreferences] = useState([]);
  const [calorieGoal, setCalorieGoal] = useState('');
  const [proteinGoal, setProteinGoal] = useState('');
  const [supermarket, setSupermarket] = useState('Tesco');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Pre-fill form with existing profile data
  useEffect(() => {
    if (profile) {
      setBudget(profile.budget ?? '');
      setHouseholdSize(profile.household_size ?? '');
      setDietaryPreferences(profile.dietary_preferences ?? []);
      setCalorieGoal(profile.calorie_goal ?? '');
      setProteinGoal(profile.protein_goal ?? '');
      setSupermarket(profile.preferred_supermarket ?? 'Tesco');
    }
  }, [profile]);

  const toggleDietaryPref = (pref) => {
    setDietaryPreferences((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  const handleSave = async () => {
    setError('');
    // Day 10: the budget and household size now drive every cost on the site,
    // so don't let them be saved blank or nonsensical.
    if (!(parseFloat(budget) > 0) || !(parseInt(householdSize, 10) > 0)) {
      setError('Enter a weekly budget and a household size above 0.');
      return;
    }
    setSuccess(false);
    setLoading(true);

    const { error } = await supabase
      .from('user_profiles')
      .update({
        budget: parseFloat(budget),
        household_size: parseInt(householdSize, 10),
        dietary_preferences: dietaryPreferences,
        calorie_goal: parseInt(calorieGoal, 10),
        protein_goal: parseInt(proteinGoal, 10),
        preferred_supermarket: supermarket,
      })
      .eq('id', userId);

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      await onSave();
      navigate('/');
    }
  };

  return (
    <div className="page page-narrow">
      <h2>Settings</h2>

      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="settings-budget">Weekly Budget (£)</label>
        <input
          id="settings-budget"
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          style={{ width: '100%', padding: '8px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="settings-household">Household Size</label>
        <input
          id="settings-household"
          type="number"
          value={householdSize}
          onChange={(e) => setHouseholdSize(e.target.value)}
          style={{ width: '100%', padding: '8px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>Dietary Preferences</label>
        {DIETARY_OPTIONS.map((pref) => (
          <label key={pref} style={{ display: 'block', marginTop: '8px' }}>
            <input
              type="checkbox"
              checked={dietaryPreferences.includes(pref)}
              onChange={() => toggleDietaryPref(pref)}
              style={{ marginRight: '8px' }}
            />
            {pref}
          </label>
        ))}
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="settings-calories">Daily Calorie Goal</label>
        <input
          id="settings-calories"
          type="number"
          value={calorieGoal}
          onChange={(e) => setCalorieGoal(e.target.value)}
          style={{ width: '100%', padding: '8px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="settings-protein">Daily Protein Goal (g)</label>
        <input
          id="settings-protein"
          type="number"
          value={proteinGoal}
          onChange={(e) => setProteinGoal(e.target.value)}
          style={{ width: '100%', padding: '8px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="settings-supermarket">Preferred Supermarket</label>
        <select
          id="settings-supermarket"
          value={supermarket}
          onChange={(e) => setSupermarket(e.target.value)}
          style={{ width: '100%', padding: '8px', marginTop: '5px' }}
        >
          {SUPERMARKETS.map((store) => (
            <option key={store} value={store}>
              {store}
            </option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>Saved!</p>}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => navigate('/')} style={{ flex: 1, padding: '10px' }}>
          Cancel
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={loading} style={{ flex: 1, padding: '10px' }}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}