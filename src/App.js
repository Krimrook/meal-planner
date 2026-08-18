import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import Signup from './components/Signup';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import Settings from './components/Settings';
import RecipeLibrary from './components/RecipeLibrary';
import MealPlanGrid from './components/MealPlanGrid';
import ShoppingList from './components/ShoppingList';
import ForgotPassword from './components/ForgotPassword';
import UpdatePassword from './components/UpdatePassword';
import { supabase } from './lib/supabase';
import './App.css';

function App() {
  const { user, loading, passwordRecovery, setPasswordRecovery } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);
  const [showMealPlan, setShowMealPlan] = useState(false);
  const [showShoppingList, setShowShoppingList] = useState(false);

  const fetchProfile = () => {
    return supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  };

  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }

    fetchProfile().then(() => setProfileLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setShowSettings(false);
    setShowRecipes(false);
    setShowMealPlan(false);
    setShowShoppingList(false);
  };

  const handleOnboardingComplete = () => {
    fetchProfile();
  };

  const handleSettingsSave = () => {
    fetchProfile();
    setShowSettings(false);
  };

  const handlePasswordUpdateComplete = () => {
  setPasswordRecovery(false);
  setShowLogin(true);
};

  if (loading || profileLoading) {
    return <div className="App">Loading...</div>;
  }

  // Password recovery flow takes priority over everything else
  if (passwordRecovery) {
    return (
      <div className="App">
        <UpdatePassword onComplete={handlePasswordUpdateComplete} />
      </div>
    );
  }

  if (user) {
    if (!profile) {
      return (
        <div className="App">
          <Onboarding userId={user.id} onComplete={handleOnboardingComplete} />
        </div>
      );
    }

    if (showSettings) {
      return (
        <div className="App">
          <Settings
            userId={user.id}
            profile={profile}
            onSave={handleSettingsSave}
            onBack={() => setShowSettings(false)}
          />
        </div>
      );
    }

    if (showRecipes) {
      return (
        <div className="App">
          <RecipeLibrary userId={user.id} onBack={() => setShowRecipes(false)} />
        </div>
      );
    }

    if (showMealPlan) {
      return (
        <div className="App">
          <MealPlanGrid userId={user.id} onBack={() => setShowMealPlan(false)} />
        </div>
      );
    }

    if (showShoppingList) {
      return (
        <div className="App">
          <ShoppingList userId={user.id} onBack={() => setShowShoppingList(false)} />
        </div>
      );
    }

    return (
      <div className="App">
        <div style={{ maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
          <h2>Welcome!</h2>
          <p>You're logged in as: {user.email}</p>
          <p>Weekly budget: £{profile.budget}</p>
          <p>Household size: {profile.household_size}</p>
          <p>Preferred supermarket: {profile.preferred_supermarket}</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
            <button onClick={() => setShowMealPlan(true)} style={{ padding: '10px 20px', cursor: 'pointer' }}>
              Meal Plan
            </button>
            <button onClick={() => setShowRecipes(true)} style={{ padding: '10px 20px', cursor: 'pointer' }}>
              Recipes
            </button>
            <button onClick={() => setShowShoppingList(true)} style={{ padding: '10px 20px', cursor: 'pointer' }}>
              Shopping List
            </button>
            <button onClick={() => setShowSettings(true)} style={{ padding: '10px 20px', cursor: 'pointer' }}>
              Settings
            </button>
            <button onClick={handleLogout} style={{ padding: '10px 20px', cursor: 'pointer' }}>
              Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <div className="App">
        <ForgotPassword onBack={() => setShowForgotPassword(false)} />
      </div>
    );
  }

  return (
    <div className="App">
      {showLogin ? <Login /> : <Signup />}
      <div style={{ textAlign: 'center', marginTop: '10px' }}>
        {showLogin ? (
          <>
            <p>
              Don't have an account?{' '}
              <button
                onClick={() => setShowLogin(false)}
                style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Sign Up
              </button>
            </p>
            <p>
              <button
                onClick={() => setShowForgotPassword(true)}
                style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Forgot Password?
              </button>
            </p>
          </>
        ) : (
          <p>
            Already have an account?{' '}
            <button
              onClick={() => setShowLogin(true)}
              style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Log In
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default App;