import { useState, useEffect } from 'react';
import { apiGet, apiPost, clearToken } from '../api/client';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/me')
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    try {
      await apiPost('/auth/logout');
    } finally {
      clearToken();
      setUser(null);
      window.location.href = '/login';
    }
  };

  return { user, loading, logout };
}
