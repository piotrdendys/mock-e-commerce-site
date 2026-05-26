import { useState, useEffect, useCallback } from 'react';
import type { CartItem } from '../types';
import { fetchCart } from '../api';

interface UseCartResult {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCart(): UseCartResult {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCart()
      .then(setItems)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { items, loading, error, refresh: load };
}
