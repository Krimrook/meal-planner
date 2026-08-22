import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuth } from './Useauth';

jest.mock('../lib/supabase');
// eslint-disable-next-line import/first
import { supabase } from '../lib/supabase';

beforeEach(() => {
  supabase.__reset();
});

test('starts loading, then resolves to a logged-out state when there is no session', async () => {
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });

  const { result } = renderHook(() => useAuth());

  expect(result.current.loading).toBe(true);

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.user).toBeNull();
  expect(result.current.passwordRecovery).toBe(false);
});

test('resolves to the session\'s user when one exists', async () => {
  const fakeUser = { id: 'user-1', email: 'scott@example.com' };
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: fakeUser } } });

  const { result } = renderHook(() => useAuth());

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.user).toEqual(fakeUser);
});

test('sets passwordRecovery when Supabase fires a PASSWORD_RECOVERY auth event', async () => {
  let authChangeCallback;
  supabase.auth.onAuthStateChange.mockImplementation((callback) => {
    authChangeCallback = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });

  const { result } = renderHook(() => useAuth());

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.passwordRecovery).toBe(false);

  act(() => {
    authChangeCallback('PASSWORD_RECOVERY', { user: { id: 'user-1' } });
  });

  expect(result.current.passwordRecovery).toBe(true);
});

test('unsubscribes from the auth listener on unmount', async () => {
  const unsubscribe = jest.fn();
  supabase.auth.onAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe } } });

  const { unmount } = renderHook(() => useAuth());
  unmount();

  expect(unsubscribe).toHaveBeenCalledTimes(1);
});