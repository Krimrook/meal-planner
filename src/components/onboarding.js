import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DIETARY_OPTIONS, SUPERMARKETS } from '../utils/constants';

export default function Onboarding({ userId, onComplete }) {
  const navigate = useNavigate();
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

  const handleNext = () => {
    // Day 10: budget and household size drive every cost in the app, so
    // step 1 can't be skipped with them blank any more.
    if (step === 1 && (!(parseFloat(budget) > 0) || !(parseInt(householdSize, 10) > 0))) {
      setError('Enter a weekly budget and a household size above 0.');
      return;
    }
    setError('');
    setStep((s) => s + 1);
  };
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
      await onComplete();
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="page page-narrow">
      <p style={{ color: '#666', marginBottom: '20px' }}>Step {step} of 4</p>

      {step === 1 && (
        <div>
          <h2>Budget & Household</h2>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="onboarding-budget">Weekly Budget (£)</label>
            <input
              id="onboarding-budget"
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="onboarding-household">Household Size</label>
            <input
              id="onboarding-household"
              type="number"
              value={householdSize}
              onChange={(e) => setHouseholdSize(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button className="btn-primary" onClick={handleNext} style={{ width: '100%', padding: '10px' }}>
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
            <label htmlFor="onboarding-calories">Daily Calorie Goal</label>
            <input
              id="onboarding-calories"
              type="number"
              value={calorieGoal}
              onChange={(e) => setCalorieGoal(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="onboarding-protein">Daily Protein Goal (g)</label>
            <input
              id="onboarding-protein"
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