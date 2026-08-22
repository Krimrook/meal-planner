import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

jest.mock('../lib/supabase');
// eslint-disable-next-line import/first
import { supabase } from '../lib/supabase';

beforeEach(() => {
  supabase.__reset();
});

function renderLogin() {
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

test('submits email and password to supabase.auth.signInWithPassword', async () => {
  renderLogin();

  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'scott@example.com' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'hunter2' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));

  await waitFor(() =>
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'scott@example.com',
      password: 'hunter2',
    })
  );
});

test('shows the error message returned by Supabase on failed login', async () => {
  supabase.auth.signInWithPassword.mockResolvedValueOnce({
    error: { message: 'Invalid login credentials' },
  });
  renderLogin();

  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'scott@example.com' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong-password' } });
  fireEvent.click(screen.getByRole('button', { name: /log in/i }));

  expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
});

test('links to Signup and Forgot Password', () => {
  renderLogin();

  expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/signup');
  expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/forgot-password');
});