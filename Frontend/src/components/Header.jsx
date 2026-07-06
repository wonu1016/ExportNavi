import { Link, useLocation } from 'react-router-dom';

export default function Header({ user, onLogout }) {
  const { pathname } = useLocation();

  const nav = [
    { to: '/', label: '대시보드', match: () => pathname === '/' },
    { to: '/dashboard/action', label: '처리 필요', match: () => pathname === '/dashboard/action' },
    { to: '/dashboard/progress', label: '진행 중', match: () => pathname === '/dashboard/progress' },
    { to: '/dashboard/completed', label: '완료 리포트', match: () => pathname === '/dashboard/completed' },
    { to: '/analysis/new', label: '새 분석', match: () => pathname === '/analysis/new' },
  ];

  return (
    <header className="bg-bg-dark border-b border-line sticky top-0 z-50">
      <div className="max-w-[1180px] mx-auto flex items-center justify-between h-16 px-5 md:px-8">
        <Link to="/" className="flex items-center gap-3 text-text">
          <span className="w-8 h-8 rounded-lg bg-[#173b5d] text-white flex items-center justify-center">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 17.5 11 4l2.3 7L20 13.5 4 20l4.2-7.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className="text-[18px] font-bold tracking-[-0.02em]">ExportNavi</span>
        </Link>

        <nav className="hidden md:flex items-center justify-center gap-5 h-full">
          {nav.map(({ to, label, match }) => (
            <Link
              key={to}
              to={to}
              className={`h-full px-1 flex items-center border-b-2 text-[13px] font-semibold transition-colors ${
                match()
                  ? 'text-green border-green'
                  : 'text-text-sub border-transparent hover:text-text'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-3">
          {user && (
            <>
              <Link
                to="/profile"
                className={`h-9 pl-2 pr-3 rounded-lg border flex items-center gap-2 transition-colors ${
                  pathname === '/profile'
                    ? 'bg-bg border-green/40 text-green'
                    : 'bg-white border-line text-text-sub hover:text-text hover:border-green/40'
                }`}
                title="마이페이지"
              >
                <span className="w-7 h-7 rounded-lg bg-bg border border-line text-[12px] font-bold flex items-center justify-center overflow-hidden">
                  {user.profileImage
                    ? <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
                    : user.name?.slice(0, 1) || 'U'}
                </span>
                <span className="hidden md:inline text-[13px] font-semibold max-w-[120px] truncate">{user.name}</span>
              </Link>
              <button
                onClick={onLogout}
                className="h-9 px-3 rounded-lg bg-bg border border-line text-[12px] font-bold text-text-sub hover:text-red hover:border-red/30 transition-colors cursor-pointer"
                title="로그아웃"
              >
                로그아웃
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
