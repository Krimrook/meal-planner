import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import Signup from './components/Signup';
import Login from './components/Login';
import { supabase } from './lib/supabase';
import './App.css';


function App() {
  const { user, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="App">Loading...</div>;
  }

  if (user) {
    return (
      <div className="App">
        <div style={{ maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
          <h2>Welcome!</h2>
          <p>You're logged in as: {user.email}</p>
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