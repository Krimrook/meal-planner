import { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
} from 'react-router-dom';
import { useAuth } from './hooks/useauth';
import Signup from './components/signup';
import Login from './components/login';
import Onboarding from './components/onboarding';
import Settings from './components/settings';
import RecipeLibrary from './components/recipeLibrary';
import MealPlanGrid from './components/mealPlanGrid';
import ShoppingList from './components/shoppingList';
import ForgotPassword from './components/forgotPassword';
import UpdatePassword from './components/updatePassword';
import Welcome from './components/welcome';
import NavBar from './components/navbar.js';
import { supabase } from './lib/supabase';
import './app.css';

// Route guard for /signup, /login, /forgot-password — a logged-in user has no
// reason to see these, so bounce them straight into the app.
// Exported alongside RequireProfile so both redirect rules can be unit tested
// directly (mount them under a MemoryRouter with a plain probe route) without
// needing to also drive the async auth/profile loading that surrounds them
// inside AppShell.
export function PublicOnly({ user }) {
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

// Route guard for every screen that needs a logged-in user with a completed
// profile (Welcome, Settings, Recipes, Meal Plan, Shopping List). Mirrors the
// old inline checks in App.js, just expressed as redirects instead of
// conditional returns. Day 6: also renders the persistent NavBar above the
// Outlet, since every route in this group is a "logged in with a profile"
// screen — the one place that's true for all of them.
export function RequireProfile({ user, profile }) {
  if (!user) return <Navigate to="/signup" replace />;
  if (!profile) return <Navigate to="/onboarding" replace />;
  return (
    <>
      <NavBar />
      <Outlet />
    </>
  );
}

// Exported (in addition to the default `App`) so tests can render it inside
// their own <MemoryRouter initialEntries={[...]}> and control the starting
// route directly, instead of being stuck with whatever <BrowserRouter> reads
// from the real browser location.
export function AppShell() {
  const { user, loading, passwordRecovery, setPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  // Tracks *which user's* profile `profile` currently reflects, rather than a
  // plain "are we loading" boolean. A boolean set back to false by the effect
  // for the previous user (e.g. the logged-out `!user` case) stays stale for
  // one render after `user` flips to a real session — during that gap
  // RequireProfile would see a real `user` with `profile` still null and
  // briefly redirect to /onboarding, even for a user who does have a
  // profile. Deriving `profileLoading` from "have we fetched for *this*
  // user yet" is correct on every render, with no such gap.
  const [profileLoadedForUserId, setProfileLoadedForUserId] = useState(null);
  const profileLoading = !!user && profileLoadedForUserId !== user.id;

  const fetchProfile = async () => {
    if (!user) return null;

    const userId = user.id;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load profile:', error);
    }

    setProfile(data ?? null);
    setProfileLoadedForUserId(userId);
    return data ?? null;
  };

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoadedForUserId(null);
      return;
    }

    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setProfileLoadedForUserId(null);
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