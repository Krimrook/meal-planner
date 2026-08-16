import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Low-Carb', 'High-Protein'];
const SUPERMARKETS = ['Tesco', "Sainsbury's", 'Asda', 'Morrisons', 'Aldi', 'Lidl', 'Waitrose'];

export default function Settings({ userId, profile, onSave, onBack }) {
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
      onSave();
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto' }}>
      <h2>Settings</h2>

      <div style={{ marginBottom: '15px' }}>
        <label>Weekly Budget (£)</label>
        <input
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          style={{ width: '100%', padding: '8px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>Household Size</label>
        <input
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
        <label>Daily Calorie Goal</label>
        <input
          type="number"
          value={calorieGoal}
          onChange={(e) => setCalorieGoal(e.target.value)}
          style={{ width: '100%', padding: '8px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>Daily Protein Goal (g)</label>
        <input
          type="number"
          value={proteinGoal}
          onChange={(e) => setProteinGoal(e.target.value)}
          style={{ width: '100%', padding: '8px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>Preferred Supermarket</label>
        <select
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
        <button onClick={onBack} style={{ flex: 1, padding: '10px' }}>
          Back
        </button>
        <button onClick={handleSave} disabled={loading} style={{ flex: 1, padding: '10px' }}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}