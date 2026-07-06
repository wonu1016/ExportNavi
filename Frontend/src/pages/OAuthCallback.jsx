import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../api/client';

export default function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      window.history.replaceState(null, '', '/oauth/callback');
    }
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-line border-t-green rounded-full animate-spin" />
    </div>
  );
}
