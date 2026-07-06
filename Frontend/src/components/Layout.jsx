import { useEffect } from 'react';
import Header from './Header';
import { useAuth } from '../hooks/useAuth';

export default function Layout({ children }) {
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) window.location.href = '/login';
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-8 h-8 border-3 border-line border-t-green rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg">
      <Header user={user} onLogout={logout} />
      <main className="max-w-[1180px] mx-auto px-5 md:px-8 py-8 md:py-12">{children}</main>
    </div>
  );
}
