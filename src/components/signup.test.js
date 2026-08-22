import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Signup from './signup';

jest.mock('../lib/supabase');
// eslint-disable-next-line import/first
import { supabase } from '../lib/supabase';

beforeEach(() => {
  supabase.__reset();
});

function renderSignup() {
  render(
    <MemoryRouter>
      <Signup />
    </MemoryRouter>
  );
}

function fillForm({ email = 'scott@example.com', password = 'password123', confirm = password } = {}) {
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
}

test('rejects mismatched passwords without calling Supabase', async () => {
  renderSignup();

  fillForm({ password: 'password123', confirm: 'somethingElse' });

  expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  expect(supabase.auth.signUp).not.toHaveBeenCalled();
});

test('rejects a too-short password without calling Supabase', async () => {
  renderSignup();

  fillForm({ password: '123', confirm: '123' });

  expect(await screen.findByText(/at least 6 characters/i)).toBeInTheDocument();
  expect(supabase.auth.signUp).not.toHaveBeenCalled();
});

test('calls supabase.auth.signUp and shows the confirmation screen on success', async () => {
  renderSignup();

  fillForm();

  expect(supabase.auth.signUp).toHaveBeenCalledWith({
    email: 'scott@example.com',
    password: 'password123',
  });
  expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
});

test('shows the error message returned by Supabase on failed signup', async () => {
  supabase.auth.signUp.mockResolvedValueOnce({ error: { message: 'Email already registered' } });
  renderSignup();

  fillForm();

  expect(await screen.findByText('Email already registered')).toBeInTheDocument();
});

test('links to Login', () => {
  renderSignup();
  expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
});