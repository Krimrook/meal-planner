// Manual Jest mock for '../lib/supabase'. Real Supabase queries are chainable
// (`.from(...).select(...).eq(...)`) and the final link in the chain is
// "thenable" — `await`-ing it resolves to `{ data, error }`. This fake
// reproduces just enough of that shape to drive components/hooks in tests
// without a network call or a real Supabase project.
//
// Usage in a test file:
//   jest.mock('../lib/supabase');
//   import { supabase } from '../lib/supabase';
//   ...
//   supabase.__table('user_profiles').__queueResult({ data: { budget: 50 }, error: null });
//   supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } });

function createQueryBuilder() {
  const resultQueue = [];
  let lastResult = { data: null, error: null };

  const nextResult = () => {
    if (resultQueue.length > 0) {
      lastResult = resultQueue.shift();
    }
    return lastResult;
  };

  const builder = {
    select: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    upsert: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    order: jest.fn(() => builder),
    maybeSingle: jest.fn(() => Promise.resolve(nextResult())),
    single: jest.fn(() => Promise.resolve(nextResult())),
    // Makes `await supabase.from(...).select(...)` work even when the code
    // under test never calls .maybeSingle()/.single() — same as the real client.
    then: (onFulfilled, onRejected) => Promise.resolve(nextResult()).then(onFulfilled, onRejected),
    // Test-only helpers (not part of the real Supabase client):
    __queueResult: (result) => {
      resultQueue.push(result);
      return builder;
    },
    __setResult: (result) => {
      lastResult = result;
      resultQueue.length = 0;
      return builder;
    },
  };

  return builder;
}

let tableBuilders = {};

function getOrCreateBuilder(table) {
  if (!tableBuilders[table]) {
    tableBuilders[table] = createQueryBuilder();
  }
  return tableBuilders[table];
}

export const supabase = {
  from: jest.fn((table) => getOrCreateBuilder(table)),
  __setup: () => {
    // Re-applied by __reset() below. Needed because Create React App's Jest
    // preset turns on `resetMocks: true`, which wipes every jest.fn's
    // implementation before EACH test — including this one, even though it
    // was only meant to be set up once when the module first loaded. Without
    // this, `supabase.from(...)` silently returns `undefined` from the
    // second test onward, which is exactly the
    // "Cannot read properties of undefined (reading 'select')" error.
    supabase.from.mockImplementation((table) => getOrCreateBuilder(table));
  },
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
    signInWithPassword: jest.fn(() => Promise.resolve({ error: null })),
    signUp: jest.fn(() => Promise.resolve({ error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    resetPasswordForEmail: jest.fn(() => Promise.resolve({ error: null })),
    updateUser: jest.fn(() => Promise.resolve({ error: null })),
  },
  // Test-only helpers:
  __table: getOrCreateBuilder,
  __reset: () => {
    tableBuilders = {};
    supabase.from.mockReset();
    supabase.__setup();
    supabase.auth.getSession.mockReset().mockResolvedValue({ data: { session: null } });
    supabase.auth.onAuthStateChange
      .mockReset()
      .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
    supabase.auth.signInWithPassword.mockReset().mockResolvedValue({ error: null });
    supabase.auth.signUp.mockReset().mockResolvedValue({ error: null });
    supabase.auth.signOut.mockReset().mockResolvedValue({ error: null });
    supabase.auth.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
    supabase.auth.updateUser.mockReset().mockResolvedValue({ error: null });
  },
};