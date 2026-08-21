import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { DIETARY_OPTIONS, SUPERMARKETS } from '../constants';

export default function Onboarding({ userId, onComplete }) {
  const [step, setStep] = useState(1);
  const [budget, setBudget] = useState('');
  const [householdSize, setHouseholdSize] = useState('');
  const [dietaryPreferences, setDietaryPreferences] = useState([]);
  const [calorieGoal, setCalorieGoal] = useState('');
  const [proteinGoal, setProteinGoal] = useState('');
  const [supermarket, setSupermarket] = useState('Tesco');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleDietaryPref = (pref) => {
    setDietaryPreferences((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  const handleNext = () => setStep((s) => s + 1);
  const handleBack = () => setStep((s) => s - 1);

  const handleComplete = async () => {
    setError('');
    setLoading(true);

    const { error } = await supabase.from('user_profiles').insert({
      id: userId,
      budget: parseFloat(budget),
      household_size: parseInt(householdSize, 10),
      dietary_preferences: dietaryPreferences,
      calorie_goal: parseInt(calorieGoal, 10),
      protein_goal: parseInt(proteinGoal, 10),
      preferred_supermarket: supermarket,
      onboarding_complete: true,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      onComplete();
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto' }}>
      <p style={{ color: '#666', marginBottom: '20px' }}>Step {step} of 4</p>

      {step === 1 && (
        <div>
          <h2>Budget & Household</h2>
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
          <button onClick={handleNext} style={{ width: '100%', padding: '10px' }}>
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>Dietary Preferences</h2>
          <div style={{ marginBottom: '15px' }}>
            {DIETARY_OPTIONS.map((pref) => (
              <label key={pref} style={{ display: 'block', marginBottom: '8px' }}>
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
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleBack} style={{ flex: 1, padding: '10px' }}>
              Back
            </button>
            <button onClick={handleNext} style={{ flex: 1, padding: '10px' }}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2>Nutrition Goals</h2>
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
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleBack} style={{ flex: 1, padding: '10px' }}>
              Back
            </button>
            <button onClick={handleNext} style={{ flex: 1, padding: '10px' }}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h2>Preferred Supermarket</h2>
          <div style={{ marginBottom: '15px' }}>
            <select
              value={supermarket}
              onChange={(e) => setSupermarket(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
            >
              {SUPERMARKETS.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          </div>

          {error && <p style={{ color: 'red' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleBack} style={{ flex: 1, padding: '10px' }}>
              Back
            </button>
            <button
              onClick={handleComplete}
              disabled={loading}
              style={{ flex: 1, padding: '10px' }}
            >
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}