import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPatch } from '../api/client';

const EMPTY = {
  companyName: '',
  businessNumber: '',
  exportExperience: '',
  mainProducts: '',
};

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/me')
      .then((profileData) => {
        setProfile(profileData);
        setForm({
          companyName: profileData.companyName ?? '',
          businessNumber: profileData.businessNumber ?? '',
          exportExperience: profileData.exportExperience ?? '',
          mainProducts: profileData.mainProducts ?? '',
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const profileCompletion = useMemo(() => {
    const fields = [form.companyName, form.businessNumber, form.exportExperience, form.mainProducts];
    return Math.round((fields.filter((value) => value?.trim()).length / fields.length) * 100);
  }, [form]);

  const change = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await apiPatch('/me', form);
      setProfile(data);
      setMessage('마이페이지 정보를 저장했습니다.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="py-24 text-center text-text-sub">마이페이지를 불러오는 중...</div>;
  }

  return (
    <div className="space-y-8">
      <section className="bg-white border border-line rounded-xl px-6 md:px-8 py-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-xl bg-[#173b5d] text-white flex items-center justify-center text-[26px] font-bold shrink-0 overflow-hidden">
              {profile?.profileImage
                ? <img src={profile.profileImage} alt="" className="w-full h-full object-cover" />
                : profile?.name?.slice(0, 1) || 'U'}
            </div>
            <div>
              <p className="text-green text-[13px] font-semibold mb-2">마이페이지</p>
              <h1 className="text-[30px] md:text-[34px] font-bold tracking-[-0.03em] text-text">
                {profile?.name || '사용자'}님의 수출 업무 공간
              </h1>
              <p className="text-[14px] text-text-sub mt-2">{profile?.email}</p>
            </div>
          </div>

          <div className="lg:w-[360px] border border-line rounded-xl px-5 py-4 bg-bg">
            <div className="flex items-center justify-between text-[12px] text-text-sub mb-2">
              <span>회사 정보 완성도</span>
              <strong className="text-text">{profileCompletion}%</strong>
            </div>
            <div className="h-2 bg-white border border-line rounded-full overflow-hidden">
              <div className="h-full bg-cyan" style={{ width: `${profileCompletion}%` }} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <div className="space-y-8">
          <section className="bg-white border border-line rounded-xl p-6 md:p-8">
            <div className="mb-7">
              <div>
                <p className="text-green text-[13px] font-semibold mb-2">회사 기본 정보</p>
                <h2 className="text-[24px] font-bold tracking-[-0.03em] text-text">분석에 반복 사용되는 정보</h2>
                <p className="text-[13px] text-text-sub mt-2">새 분석을 시작할 때 참고할 회사와 제품 정보를 관리합니다.</p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="회사명" value={form.companyName} onChange={change('companyName')} placeholder="예: 주식회사 엑스포트나비" />
                <Field label="사업자등록번호" value={form.businessNumber} onChange={change('businessNumber')} placeholder="숫자 또는 하이픈 포함" />
              </div>
              <Field label="수출 경험" value={form.exportExperience} onChange={change('exportExperience')} placeholder="예: 수출 준비 중 / 1~3년 / 3년 이상" />
              <div>
                <label className="block text-[12px] font-bold text-text-sub mb-2">주요 제품</label>
                <textarea
                  value={form.mainProducts}
                  onChange={change('mainProducts')}
                  rows={5}
                  placeholder="주요 제품, 소재, 용도, 주요 판매 국가를 적어두면 새 분석을 시작할 때 참고하기 좋습니다."
                  className="w-full px-4 py-3 bg-bg border border-line text-[14px] focus:outline-none focus:border-green resize-none"
                />
              </div>

              {error && <p className="text-[13px] text-red">{error}</p>}
              {message && <p className="text-[13px] text-green">{message}</p>}

              <button disabled={saving} className="h-11 px-6 bg-[#173b5d] text-white text-[13px] font-bold disabled:opacity-40 cursor-pointer">
                {saving ? '저장 중...' : '마이페이지 저장'}
              </button>
            </form>
          </section>
        </div>

        <aside className="space-y-8">
          <section className="bg-white border border-line rounded-xl p-6">
            <p className="text-green text-[13px] font-semibold mb-2">계정</p>
            <h2 className="text-[22px] font-bold tracking-[-0.03em] text-text mb-5">접속 정보</h2>
            <div className="space-y-4">
              <InfoRow label="이름" value={profile?.name || '-'} />
              <InfoRow label="이메일" value={profile?.email || '-'} />
              <InfoRow label="권한" value={profile?.role || 'USER'} />
              <InfoRow label="로그인 방식" value={profile?.profileImage ? 'Google OAuth' : '이메일 계정'} />
            </div>
          </section>

          <section className="bg-white border border-line rounded-xl p-6">
            <p className="text-orange text-[13px] font-semibold mb-2">보안 안내</p>
            <h2 className="text-[22px] font-bold tracking-[-0.03em] text-text mb-4">저장되는 정보</h2>
            <p className="text-[13px] text-text-sub leading-relaxed">
              회사명, 사업자등록번호, 수출 경험, 주요 제품 정보는 분석 편의를 위해 계정에 저장됩니다. 민감 정보는 필요한 범위만 입력하세요.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-[12px] font-bold text-text-sub mb-2">{label}</label>
      <input value={value} onChange={onChange} placeholder={placeholder} className="w-full h-11 px-4 bg-bg border border-line text-[14px] focus:outline-none focus:border-green" />
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line pb-3 last:border-b-0 last:pb-0">
      <span className="text-[12px] text-text-faint">{label}</span>
      <strong className="text-[13px] text-text text-right break-all">{value}</strong>
    </div>
  );
}
