import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div style={{ maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
        <h2>Check your email!</h2>
        <p>We sent you a password reset link.</p>
        <button onClick={onBack} style={{ padding: '10px 20px', cursor: 'pointer', marginTop: '15px' }}>
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto' }}>
      <h2>Reset Password</h2>
      <p style={{ color: '#666', marginBottom: '15px' }}>
        Enter your email and we'll send you a reset link.
      </p>
      <form onSubmit={handleReset}>
        <div style={{ marginBottom: '15px' }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', cursor: 'pointer' }}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', textDecoration: 'underline', marginTop: '10px' }}
      >
        Back to Login
      </button>
    </div>
  );
}