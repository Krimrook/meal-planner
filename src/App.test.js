import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PublicOnly, RequireProfile, AppShell } from './App';

jest.mock('./lib/supabase');
// eslint-disable-next-line import/first
import { supabase } from './lib/supabase';

beforeEach(() => {
  supabase.__reset();
});

// ---------------------------------------------------------------------------
// Route guards, tested in isolation from the rest of AppShell's async loading.
// Each is mounted under its own tiny Routes tree with a probe route standing
// in for whatever real screen would normally sit behind the guard.
// ---------------------------------------------------------------------------

function renderGuard(GuardElement, initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={GuardElement}>
          <Route path="/protected" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/signup" element={<div>Signup Page</div>} />
        <Route path="/onboarding" element={<div>Onboarding Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PublicOnly', () => {
  test('renders the route when logged out', () => {
    renderGuard(<PublicOnly user={null} />, '/protected');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  test('redirects to / when already logged in', () => {
    renderGuard(<PublicOnly user={{ id: 'user-1' }} />, '/protected');
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});

describe('RequireProfile', () => {
  test('redirects to /signup when logged out', () => {
    renderGuard(<RequireProfile user={null} profile={null} />, '/protected');
    expect(screen.getByText('Signup Page')).toBeInTheDocument();
  });

  test('redirects to /onboarding when logged in without a profile', () => {
    renderGuard(<RequireProfile user={{ id: 'user-1' }} profile={null} />, '/protected');
    expect(screen.getByText('Onboarding Page')).toBeInTheDocument();
  });

  test('renders the route when logged in with a profile', () => {
    renderGuard(<RequireProfile user={{ id: 'user-1' }} profile={{ budget: 50 }} />, '/protected');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AppShell integration tests — exercises the real loading → auth → profile →
// routing pipeline against the mocked Supabase client.
// ---------------------------------------------------------------------------

function renderApp(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppShell />
    </MemoryRouter>
  );
}

test('shows a loading state before the session check resolves', () => {
  // Never resolves within this test — keeps the component in its loading state.
  supabase.auth.getSession.mockReturnValueOnce(new Promise(() => {}));
  renderApp('/');
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});

test('logged-out user visiting any route lands on Signup', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
  renderApp('/recipes');

  expect(await screen.findByRole('heading', { name: /sign up/i })).toBeInTheDocument();
});

test('logged-in user with no profile is sent to Onboarding regardless of the route', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'user-1' } } } });
  supabase.__table('user_profiles').__queueResult({ data: null, error: null });

  renderApp('/settings');

  expect(await screen.findByText(/step 1 of 4/i)).toBeInTheDocument();
});

test('logged-in user with a profile sees the Welcome screen at /', async () => {
  const fakeUser = { id: 'user-1', email: 'scott@example.com' };
  const fakeProfile = { budget: 60, household_size: 2, preferred_supermarket: 'Tesco' };
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: fakeUser } } });
  supabase.__table('user_profiles').__queueResult({ data: fakeProfile, error: null });

  renderApp('/');

  expect(await screen.findByRole('heading', { name: /welcome/i })).toBeInTheDocument();
  expect(screen.getByText(/scott@example\.com/)).toBeInTheDocument();
});

test('logged-in user with a profile can reach Settings directly by URL', async () => {
  const fakeUser = { id: 'user-1', email: 'scott@example.com' };
  const fakeProfile = { budget: 60, household_size: 2, preferred_supermarket: 'Tesco' };
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: fakeUser } } });
  supabase.__table('user_profiles').__queueResult({ data: fakeProfile, error: null });

  renderApp('/settings');

  expect(await screen.findByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
});

test('a returning user is never bounced through Onboarding on the way to a bookmarked page', async () => {
  // Regression test: profile-loading used to be tracked as a plain boolean
  // that a previous render could leave stale at `false` for one tick right
  // after `user` changed, letting RequireProfile briefly redirect to
  // /onboarding (then on to /) before the real profile arrived — clobbering
  // whatever route the user actually bookmarked or refreshed on.
  const fakeUser = { id: 'user-1', email: 'scott@example.com' };
  const fakeProfile = { budget: 60, household_size: 2, preferred_supermarket: 'Tesco' };
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: fakeUser } } });
  supabase.__table('user_profiles').__queueResult({ data: fakeProfile, error: null });
  supabase.__table('recipes').__queueResult({ data: [], error: null });

  renderApp('/recipes');

  expect(await screen.findByRole('heading', { name: /my recipes/i })).toBeInTheDocument();
  expect(screen.queryByText(/step 1 of 4/i)).not.toBeInTheDocument();
});

test('an already-logged-in user visiting /login is bounced to Welcome', async () => {
  const fakeUser = { id: 'user-1', email: 'scott@example.com' };
  const fakeProfile = { budget: 60, household_size: 2, preferred_supermarket: 'Tesco' };
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: fakeUser } } });
  supabase.__table('user_profiles').__queueResult({ data: fakeProfile, error: null });

  renderApp('/login');

  expect(await screen.findByRole('heading', { name: /welcome/i })).toBeInTheDocument();
});

test('an unknown URL falls back to / instead of a blank screen', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
  renderApp('/this-route-does-not-exist');

  // Logged out, so / itself redirects on to Signup — the point being it
  // doesn't dead-end on the unknown route.
  expect(await screen.findByRole('heading', { name: /sign up/i })).toBeInTheDocument();
});

test('password recovery takes over the screen regardless of route', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
  let authChangeCallback;
  supabase.auth.onAuthStateChange.mockImplementation((callback) => {
    authChangeCallback = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });

  renderApp('/recipes');

  await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());

  act(() => {
    authChangeCallback('PASSWORD_RECOVERY', { user: { id: 'user-1' } });
  });

  expect(await screen.findByRole('heading', { name: /set new password/i })).toBeInTheDocument();
});