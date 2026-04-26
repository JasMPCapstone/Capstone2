import { useCallback, useMemo, useEffect, useState } from 'react';
import { AuthContext } from './auth-context';
import { fetchMe } from '../lib/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (opts) => {
    const quiet = !!(opts && opts.quiet);
    setError(null);
    if (!quiet) setLoading(true);
    try {
      const result = await fetchMe();
      if (result.kind === 'redirect') {
        setUser(null);
        return;
      }
      if (result.kind === 'unauthorized') {
        setUser(null);
        return;
      }
      if (result.kind === 'error') {
        setUser(null);
        setError(result.error);
        return;
      }
      setUser(result.data);
    } catch (e) {
      setUser(null);
      setError(e instanceof Error ? e.message : 'Could not load session.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const result = await fetchMe();
        if (cancelled) return;
        if (result.kind === 'redirect') {
          setUser(null);
          return;
        }
        if (result.kind === 'unauthorized') {
          setUser(null);
          return;
        }
        if (result.kind === 'error') {
          setUser(null);
          setError(result.error);
          return;
        }
        setUser(result.data);
      } catch (e) {
        if (cancelled) return;
        setUser(null);
        setError(e instanceof Error ? e.message : 'Could not load session.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      refresh,
      setUser,
    }),
    [user, loading, error, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
