import { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
} from 'react-router-dom';
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
import Welcome from './components/Welcome';
import { supabase } from './lib/supabase';
import './App.css';

// Route guard for /signup, /login, /forgot-password — a logged-in user has no
// reason to see these, so bounce them straight into the app.
function PublicOnly({ user }) {
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

// Route guard for every screen that needs a logged-in user with a completed
// profile (Welcome, Settings, Recipes, Meal Plan, Shopping List). Mirrors the
// old inline checks in App.js, just expressed as redirects instead of
// conditional returns.
function RequireProfile({ user, profile }) {
  if (!user) return <Navigate to="/signup" replace />;
  if (!profile) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

function AppShell() {
  const { user, loading, passwordRecovery, setPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

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
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    fetchProfile().then(() => setProfileLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    // No explicit navigate needed: once `user` clears, RequireProfile sends
    // any protected route straight to /signup on the next render.
  };

  const handlePasswordUpdateComplete = () => {
    setPasswordRecovery(false);
    navigate('/login', { replace: true });
  };

  if (loading || profileLoading) {
    return <div className="App">Loading...</div>;
  }

  // Password recovery takes priority over everything else, regardless of
  // whatever route the user happens to be on — Supabase redirects them back
  // to wherever they last were, plus a recovery token, not a route we control.
  if (passwordRecovery) {
    return (
      <div className="App">
        <UpdatePassword onComplete={handlePasswordUpdateComplete} />
      </div>
    );
  }

  return (
    <div className="App">
      <Routes>
        <Route element={<PublicOnly user={user} />}>
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>

        {/* Needs a logged-in user, but deliberately sits outside RequireProfile
            since its whole job is to run *before* a profile exists. */}
        <Route
          path="/onboarding"
          element={
            !user ? (
              <Navigate to="/signup" replace />
            ) : profile ? (
              <Navigate to="/" replace />
            ) : (
              <Onboarding userId={user.id} onComplete={fetchProfile} />
            )
          }
        />

        <Route element={<RequireProfile user={user} profile={profile} />}>
          <Route path="/" element={<Welcome user={user} profile={profile} onLogout={handleLogout} />} />
          <Route path="/settings" element={<Settings userId={user?.id} profile={profile} onSave={fetchProfile} />} />
          <Route path="/recipes" element={<RecipeLibrary userId={user?.id} />} />
          <Route path="/meal-plan" element={<MealPlanGrid userId={user?.id} />} />
          <Route path="/shopping-list" element={<ShoppingList userId={user?.id} />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;