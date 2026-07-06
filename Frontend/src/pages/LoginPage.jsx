import { useState } from 'react';
import { apiPublicPost, backendUrl, setToken } from '../api/client';

const initialForm = {
  email: '',
  password: '',
  name: '',
};

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(initialForm);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') !== 'oauth') return '';
    return params.get('message') || 'Google 로그인에 실패했습니다. 백엔드 OAuth 설정을 확인해주세요.';
  });

  const isSignup = mode === 'signup';

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  const updateField = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiPublicPost(isSignup ? '/auth/signup' : '/auth/login', {
        email: form.email.trim(),
        password: form.password,
        rememberMe: remember,
        ...(isSignup ? { name: form.name.trim() } : {}),
      });
      if (data?.token && remember) {
        setToken(data.token);
      }
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f6f8] grid lg:grid-cols-[minmax(0,1fr)_540px]">
      <section className="relative overflow-hidden px-7 md:px-16 lg:px-[7vw] py-9 min-h-[44vh] lg:min-h-screen bg-[#15384f] text-white flex flex-col justify-between">
        <div className="absolute inset-0 opacity-25" aria-hidden="true">
          <div className="absolute left-[-12%] top-[15%] w-[520px] h-[520px] rounded-full bg-[#2f8f9b] blur-[120px]" />
          <div className="absolute right-[8%] bottom-[-18%] w-[420px] h-[420px] rounded-full bg-[#d59638] blur-[120px]" />
        </div>

        <div className="relative flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg border border-white/25 bg-white/10 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 17.5 11 4l2.3 7L20 13.5 4 20l4.2-7.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-[21px] font-bold">ExportNavi</span>
        </div>

        <div className="relative max-w-[650px] my-14 lg:my-0">
          <p className="text-[#9fd5d7] text-[13px] font-semibold mb-5">수출 사전검토 워크스페이스</p>
          <h1 className="text-[40px] md:text-[56px] font-bold leading-[1.12] tracking-[-0.04em] mb-7">
            분석 기록을 이어서 보고<br />다음 수출 결정을 준비하세요.
          </h1>
          <p className="text-white/72 text-[16px] leading-[1.85] max-w-[560px]">
            이메일 계정 또는 Google 계정으로 로그인해 HS코드 후보, 시장 추천, 위험 검토 결과를 안전하게 관리할 수 있습니다.
          </p>
        </div>

        <div className="relative grid sm:grid-cols-3 border-y border-white/18">
          {['분석 리포트 저장', '회사 프로필 관리', '공유 링크 발급'].map((item, index) => (
            <span key={item} className={`py-4 text-[13px] text-white/78 ${index > 0 ? 'sm:border-l sm:border-white/18 sm:pl-5' : ''}`}>
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="bg-white px-6 md:px-12 py-10 flex items-center justify-center">
        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <p className="text-cyan text-[13px] font-semibold mb-2">계정 접속</p>
            <h2 className="text-[32px] font-bold tracking-[-0.03em] text-text mb-3">
              {isSignup ? '새 계정 만들기' : '다시 시작하기'}
            </h2>
            <p className="text-text-sub text-[14px] leading-relaxed">
              {isSignup
                ? '업무용 이메일로 가입하면 바로 분석을 시작할 수 있습니다.'
                : '저장된 분석 리포트와 초안을 불러오려면 로그인하세요.'}
            </p>
          </div>

          <div className="grid grid-cols-2 p-1 bg-bg border border-line rounded-lg mb-7">
            <button
              type="button"
              onClick={() => changeMode('login')}
              className={`h-11 text-[14px] font-semibold transition ${!isSignup ? 'bg-white text-text shadow-sm' : 'text-text-sub hover:text-text'}`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => changeMode('signup')}
              className={`h-11 text-[14px] font-semibold transition ${isSignup ? 'bg-white text-text shadow-sm' : 'text-text-sub hover:text-text'}`}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {isSignup && (
              <label className="block">
                <span className="block text-[13px] font-semibold text-text mb-2">이름</span>
                <input
                  value={form.name}
                  onChange={updateField('name')}
                  required
                  autoComplete="name"
                  placeholder="홍길동"
                  className="w-full h-12 px-4 border border-line bg-white text-[15px] outline-none focus:border-cyan focus:ring-4 focus:ring-cyan/10"
                />
              </label>
            )}

            <label className="block">
              <span className="block text-[13px] font-semibold text-text mb-2">이메일</span>
              <input
                type="email"
                value={form.email}
                onChange={updateField('email')}
                required
                autoComplete="email"
                placeholder="name@company.com"
                className="w-full h-12 px-4 border border-line bg-white text-[15px] outline-none focus:border-cyan focus:ring-4 focus:ring-cyan/10"
              />
            </label>

            <label className="block">
              <span className="block text-[13px] font-semibold text-text mb-2">비밀번호</span>
              <input
                type="password"
                value={form.password}
                onChange={updateField('password')}
                required
                minLength={isSignup ? 8 : undefined}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder={isSignup ? '8자 이상 입력' : '비밀번호 입력'}
                className="w-full h-12 px-4 border border-line bg-white text-[15px] outline-none focus:border-cyan focus:ring-4 focus:ring-cyan/10"
              />
            </label>

            <div className="flex items-center gap-4 min-h-8">
              <label className="inline-flex items-center gap-2 text-[13px] text-text-sub cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="w-4 h-4 accent-cyan"
                />
                로그인 상태 유지
              </label>
            </div>

            {error && (
              <div className="px-4 py-3 bg-red/10 border border-red/20 text-red text-[13px] leading-relaxed">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#173b5d] text-white text-[15px] font-semibold hover:bg-[#102b43] disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? '처리 중...' : isSignup ? '회원가입하고 시작하기' : '로그인'}
            </button>
          </form>

          <div className="flex items-center gap-4 my-7">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[12px] text-text-faint">또는</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            onClick={() => { window.location.href = backendUrl('/oauth2/authorization/google'); }}
            className="w-full h-12 px-5 bg-white border border-line text-[15px] font-semibold text-text hover:border-cyan hover:bg-bg-hover transition flex items-center justify-center gap-3"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google로 계속하기
          </button>

          <p className="mt-6 text-[12px] leading-relaxed text-text-faint">
            가입 또는 로그인하면 ExportNavi의 분석 결과 저장 및 서비스 제공을 위한 기본 계정 처리에 동의한 것으로 간주됩니다.
          </p>
        </div>
      </section>
    </main>
  );
}
