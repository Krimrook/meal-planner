import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import Signup from './components/Signup';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import { supabase } from './lib/supabase';
import './App.css';

function App() {
  const { user, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }

    supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setProfileLoading(false);
      });
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const handleOnboardingComplete = () => {
    // Re-fetch profile after onboarding saves
    supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  };

  if (loading || profileLoading) {
    return <div className="App">Loading...</div>;
  }

  if (user) {
    if (!profile) {
      return (
        <div className="App">
          <Onboarding userId={user.id} onComplete={handleOnboardingComplete} />
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
          <button onClick={handleLogout} style={{ padding: '10px 20px', cursor: 'pointer' }}>
            Log Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {showLogin ? <Login /> : <Signup />}
      <div style={{ textAlign: 'center', marginTop: '10px' }}>
        {showLogin ? (
          <p>
            Don't have an account?{' '}
            <button
              onClick={() => setShowLogin(false)}
              style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Sign Up
            </button>
          </p>
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