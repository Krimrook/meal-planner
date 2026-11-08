import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { buildPriceTable } from '../utils/priceUtils.js';

// Loads the user's own ingredient prices and turns them into a lookup table
// for priceUtils.js. Shared by every screen that shows money, so they all
// agree. If the load fails (e.g. the Day 10 migration hasn't been run yet),
// the table is just empty and starter prices are used — the error is still
// returned so the screen can mention it.
export function usePriceTable(userId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    if (!userId) return Promise.resolve();
    setLoading(true);
    return supabase
      .from('ingredient_prices')
      .select('*')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (error) {
          setError(`Couldn't load your saved prices (using starter prices): ${error.message}`);
          setRows([]);
        } else {
          setError('');
          setRows(data ?? []);
        }
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const table = useMemo(() => buildPriceTable(rows), [rows]);
  return { table, rows, loading, error, reload };
}
