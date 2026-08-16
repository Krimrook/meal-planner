import { useAuth } from './hooks/useAuth';
import Signup from './components/Signup';
import { supabase } from './lib/supabase';
import './App.css';

function App() {
  const { user, loading } = useAuth();

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
      <Signup />
    </div>
  );
}

export default App;