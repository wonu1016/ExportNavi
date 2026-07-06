import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiGet } from '../api/client';

const DRAFT_KEY = 'exportnavi.analysis.new.draft';
const DRAFT_PROMPT_KEY = 'exportnavi.analysis.new.draft.prompted';

const STATUS = {
  PENDING: { label: '초안', dot: 'bg-text-faint' },
  HS_CODE_ESTIMATED: { label: 'HS 선택 필요', dot: 'bg-yellow' },
  HS_CODE_CONFIRMED: { label: 'HS 확정', dot: 'bg-cyan' },
  ANALYZING: { label: '분석 중', dot: 'bg-orange' },
  COMPLETED: { label: '완료', dot: 'bg-green' },
  FAILED: { label: '실패', dot: 'bg-red' },
};

const GRADE_COLOR = { A: 'text-green', B: 'text-cyan', C: 'text-yellow', D: 'text-red' };

function fmtDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function daysSince(value) {
  if (!value) return 0;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

function confirmedHs(report) {
  return report.confirmedHsCode || report.hsCodes?.find((item) => item.confirmed)?.code || '';
}

function hasSourceIssue(report) {
  return report.dataStale || report.dataSourceStatuses?.some((source) => source.status === 'DEMO' || source.status === 'FAILED');
}

function openChecklist(report) {
  return (report.actionChecklist ?? []).filter((item) => !item.completed);
}

function readBrowserDraft() {
  try {
    const rawDraft = localStorage.getItem(DRAFT_KEY);
    const draft = rawDraft ? JSON.parse(rawDraft) : null;
    return draft && (draft.name || draft.desc || draft.details) ? draft : null;
  } catch {
    localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}

const VIEW_META = {
  all: {
    eyebrow: '대시보드',
    title: '오늘 처리할 수출 분석',
    desc: '이어갈 분석, 확인 필요한 리포트, 남은 실행 항목을 한 곳에서 봅니다.',
  },
  action: {
    eyebrow: '처리 필요',
    title: '지금 확인해야 할 리포트',
    desc: '실패, HS코드 선택 대기, 출처 확인, 미완료 체크리스트가 있는 리포트만 모았습니다.',
  },
  progress: {
    eyebrow: '진행 중',
    title: '이어서 작업할 분석',
    desc: '초안, HS코드 선택, 분석 중 상태의 리포트를 이어서 처리합니다.',
  },
  completed: {
    eyebrow: '완료 리포트',
    title: '완료된 수출 분석',
    desc: '공유, 인쇄, 비교에 사용할 수 있는 완료 리포트입니다.',
  },
};

const VIEW_PATH = {
  all: '/',
  action: '/dashboard/action',
  progress: '/dashboard/progress',
  completed: '/dashboard/completed',
};

export default function AnalysisList({ viewMode = null }) {
  const [reports, setReports] = useState([]);
  const [profile, setProfile] = useState(null);
  const [browserDraft] = useState(readBrowserDraft);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [compareIds, setCompareIds] = useState([]);
  const navigate = useNavigate();
  const activeView = viewMode || 'all';
  const isDashboard = !viewMode;
  const viewMeta = VIEW_META[activeView] || VIEW_META.all;

  useEffect(() => {
    loadReports();
  }, []);

  function loadReports(search = '') {
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet(`/analysis${search ? `?query=${encodeURIComponent(search)}` : ''}`),
      apiGet('/me'),
    ])
      .then(([reportData, profileData]) => {
        setReports(reportData ?? []);
        setProfile(profileData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function submitSearch(e) {
    e.preventDefault();
    loadReports(query.trim());
  }

  function toggleCompare(id) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((value) => value !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function resumeBrowserDraft() {
    sessionStorage.removeItem(DRAFT_PROMPT_KEY);
    navigate('/analysis/new');
  }

  function changeView(nextView) {
    navigate(VIEW_PATH[nextView] || '/');
  }

  const dashboard = useMemo(() => {
    const completed = reports.filter((report) => report.status === 'COMPLETED');
    const inProgress = reports.filter((report) => ['ANALYZING', 'HS_CODE_CONFIRMED'].includes(report.status));
    const needsHs = reports.filter((report) => report.status === 'HS_CODE_ESTIMATED');
    const failed = reports.filter((report) => report.status === 'FAILED');
    const drafts = reports.filter((report) => report.status === 'PENDING');
    const sourceIssues = reports.filter(hasSourceIssue);
    const checklistItems = reports.flatMap((report) => openChecklist(report).map((item) => ({
      ...item,
      reportId: report.id,
      reportTitle: report.reportTitle || report.productName,
    })));

    const actionQueue = [
      ...failed.map((report) => ({ type: '실패', tone: 'text-red', report, title: '재분석 필요', detail: report.failureMessage || '분석을 완료하지 못했습니다.' })),
      ...needsHs.map((report) => ({ type: 'HS', tone: 'text-yellow', report, title: 'HS코드 선택', detail: '후보 중 하나를 확정하면 시장·위험 분석을 이어갈 수 있습니다.' })),
      ...sourceIssues.map((report) => ({ type: '출처', tone: 'text-orange', report, title: report.dataStale ? '데이터 재조회 권장' : '출처 확인 필요', detail: '일부 데이터가 데모이거나 조회 실패 상태입니다.' })),
      ...checklistItems.slice(0, 6).map((item) => ({ type: '할 일', tone: 'text-cyan', report: { id: item.reportId, productName: item.reportTitle }, title: item.title || item.task || item.description || '체크리스트 확인', detail: item.reportTitle })),
    ].slice(0, 6);

    const recentActive = [...reports]
      .filter((report) => report.status !== 'COMPLETED')
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 3);

    const countryCounts = new Map();
    reports.forEach((report) => {
      (report.marketRecommendations ?? []).slice(0, 2).forEach((market) => {
        countryCounts.set(market.countryName, (countryCounts.get(market.countryName) ?? 0) + 1);
      });
    });
    const topCountries = [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const sourceSummary = ['ai', 'market', 'risk', 'strategic'].map((key) => {
      const statuses = reports
        .flatMap((report) => report.dataSourceStatuses ?? [])
        .filter((source) => source.key === key);
      const latest = statuses.at(-1);
      const failed = statuses.filter((source) => source.status === 'FAILED').length;
      const demo = statuses.filter((source) => source.status === 'DEMO').length;
      return {
        key,
        name: latest?.name || ({ ai: 'OpenAI', market: 'KOTRA', risk: 'KSURE', strategic: 'YesTrade' }[key]),
        total: statuses.length,
        failed,
        demo,
        status: failed > 0 ? '점검' : demo > 0 ? '확인' : statuses.length > 0 ? '정상' : '대기',
      };
    });

    return {
      completed: completed.length,
      inProgress: inProgress.length,
      needsHs: needsHs.length,
      failed: failed.length,
      drafts: drafts.length,
      sourceIssues: sourceIssues.length,
      openTasks: checklistItems.length,
      actionQueue,
      recentActive,
      topCountries,
      sourceSummary,
    };
  }, [reports]);

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    const fields = [profile.companyName, profile.businessNumber, profile.exportExperience, profile.mainProducts];
    return Math.round((fields.filter((value) => value?.trim()).length / fields.length) * 100);
  }, [profile]);

  const readinessScore = useMemo(() => {
    const base = Math.min(40, reports.length * 8);
    const completed = Math.min(25, dashboard.completed * 8);
    const profilePoints = Math.round(profileCompletion * 0.2);
    const penalty = Math.min(25, dashboard.failed * 8 + dashboard.sourceIssues * 5);
    return Math.max(0, Math.min(100, base + completed + profilePoints - penalty));
  }, [dashboard.completed, dashboard.failed, dashboard.sourceIssues, profileCompletion, reports.length]);

  const filteredReports = useMemo(() => {
    const byView = {
      all: () => true,
      action: (report) => report.status === 'FAILED' || report.status === 'HS_CODE_ESTIMATED' || hasSourceIssue(report) || openChecklist(report).length > 0,
      progress: (report) => ['PENDING', 'HS_CODE_ESTIMATED', 'HS_CODE_CONFIRMED', 'ANALYZING'].includes(report.status),
      completed: (report) => report.status === 'COMPLETED',
    }[activeView] ?? (() => true);
    return reports.filter(byView);
  }, [reports, activeView]);

  const topCompare = reports.filter((report) => compareIds.includes(report.id));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <p className="text-green text-[13px] font-semibold mb-2">{viewMeta.eyebrow}</p>
          <h1 className="text-[30px] md:text-[34px] font-bold tracking-[-0.03em] text-text">{viewMeta.title}</h1>
          <p className="text-text-sub text-[14px] mt-2">{viewMeta.desc}</p>
        </div>
        <Link
          to="/analysis/new"
          className="h-10 px-5 bg-[#173b5d] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#102c46] transition-all"
        >
          <span className="text-[18px] font-normal">＋</span> 새 분석
        </Link>
      </div>

      {isDashboard && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard to="/dashboard/action" label="처리 필요" value={dashboard.actionQueue.length} note="오늘 확인할 항목" tone="text-orange" />
        <SummaryCard to="/dashboard/progress" label="진행 중" value={dashboard.inProgress + dashboard.needsHs + dashboard.drafts} note="이어서 작업 가능" tone="text-cyan" />
        <SummaryCard to="/dashboard/completed" label="완료 리포트" value={dashboard.completed} note="공유·인쇄 가능" tone="text-green" />
        <SummaryCard to="/dashboard/action" label="출처 확인" value={dashboard.sourceIssues} note="데이터 상태 점검" tone="text-yellow" />
      </div>}

      {isDashboard && !loading && !error && (
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <section className="bg-[#173b5d] text-white rounded-xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-white/60 text-[13px] font-semibold mb-2">수출 준비도</p>
                <h2 className="text-[28px] font-bold tracking-[-0.03em] mb-2">{readinessScore}점</h2>
                <p className="text-[13px] text-white/70 leading-relaxed">
                  회사 정보, 완료 리포트, 실패/출처 이슈를 합쳐 본 업무 준비 상태입니다.
                </p>
              </div>
              <div className="md:w-[280px]">
                <div className="h-3 bg-white/15 rounded-full overflow-hidden">
                  <div className="h-full bg-[#44c2c7]" style={{ width: `${readinessScore}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-[12px] text-white/72">
                  <span>프로필 {profileCompletion}%</span>
                  <span>완료 {dashboard.completed}</span>
                  <span>이슈 {dashboard.sourceIssues + dashboard.failed}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-line rounded-xl p-6">
            <p className="text-cyan text-[13px] font-semibold mb-2">빠른 실행</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Link to="/analysis/new" className="h-11 px-4 bg-[#173b5d] text-white text-[13px] font-bold inline-flex items-center justify-center">
                새 제품 분석
              </Link>
              <button
                type="button"
                onClick={() => changeView('action')}
                className="h-11 px-4 bg-white border border-line text-[13px] font-bold text-text-sub hover:border-orange"
              >
                처리 필요 보기
              </button>
              <Link to="/profile" className="h-11 px-4 bg-white border border-line text-[13px] font-bold text-text-sub hover:border-cyan inline-flex items-center justify-center">
                회사 정보 관리
              </Link>
              <button
                type="button"
                onClick={resumeBrowserDraft}
                disabled={!browserDraft}
                className="h-11 px-4 bg-white border border-line text-[13px] font-bold text-text-sub hover:border-green disabled:opacity-40 disabled:hover:border-line"
              >
                {browserDraft ? '브라우저 초안 이어쓰기' : '저장된 초안 없음'}
              </button>
            </div>
          </section>
        </div>
      )}

      {isDashboard && !loading && !error && (browserDraft || profileCompletion < 100 || dashboard.failed > 0 || dashboard.sourceIssues > 0) && (
        <section className="grid md:grid-cols-3 gap-4">
          {browserDraft && (
            <DashboardNotice
              tone="cyan"
              title="작성 중인 초안"
              text={browserDraft.name || browserDraft.desc || '브라우저에 저장된 제품 정보가 있습니다.'}
              action="이어쓰기"
              onClick={resumeBrowserDraft}
            />
          )}
          {profileCompletion < 100 && (
            <DashboardNotice
              tone="yellow"
              title="회사 정보 보강"
              text="회사명, 수출 경험, 주요 제품을 채우면 반복 입력이 줄어듭니다."
              action="입력하기"
              to="/profile"
            />
          )}
          {(dashboard.failed > 0 || dashboard.sourceIssues > 0) && (
            <DashboardNotice
              tone="orange"
              title="검토 필요한 데이터"
              text={`실패 ${dashboard.failed}건, 출처 확인 ${dashboard.sourceIssues}건이 있습니다.`}
              action="확인하기"
              onClick={() => changeView('action')}
            />
          )}
        </section>
      )}

      {isDashboard && !loading && !error && reports.length > 0 && (
        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <section className="bg-white border border-line rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-line flex items-center justify-between gap-4">
              <div>
                <p className="text-orange text-[13px] font-semibold mb-1">업무 큐</p>
                <h2 className="text-[22px] font-bold tracking-[-0.03em] text-text">먼저 처리할 항목</h2>
              </div>
              <button type="button" onClick={() => changeView('action')} className="text-[12px] font-semibold text-cyan hover:underline">
                목록에서 보기
              </button>
            </div>

            {dashboard.actionQueue.length === 0 ? (
              <div className="px-6 py-10 text-[14px] text-text-sub">현재 바로 처리해야 할 항목이 없습니다.</div>
            ) : (
              <div className="divide-y divide-line">
                {dashboard.actionQueue.map((item, index) => (
                  <button
                    key={`${item.type}-${item.report.id}-${index}`}
                    type="button"
                    onClick={() => navigate(`/analysis/${item.report.id}`)}
                    className="w-full text-left px-6 py-4 hover:bg-bg-hover transition grid sm:grid-cols-[90px_1fr_auto] gap-3 items-center"
                  >
                    <span className={`text-[12px] font-bold ${item.tone}`}>{item.type}</span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-bold text-text truncate">{item.title}</span>
                      <span className="block text-[12px] text-text-sub truncate">{item.report.reportTitle || item.report.productName} · {item.detail}</span>
                    </span>
                    <span className="text-[12px] text-text-faint">열기</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <section className="bg-white border border-line rounded-xl p-5">
              <p className="text-orange text-[13px] font-semibold mb-1">데이터 상태</p>
              <h2 className="text-[20px] font-bold tracking-[-0.03em] text-text mb-4">출처 모니터</h2>
              <div className="space-y-3">
                {dashboard.sourceSummary.map((source) => (
                  <div key={source.key} className="flex items-center justify-between gap-4">
                    <span className="text-[13px] font-semibold text-text">{source.name}</span>
                    <span className={`text-[12px] font-bold ${
                      source.status === '점검' ? 'text-red' : source.status === '확인' ? 'text-yellow' : source.status === '정상' ? 'text-green' : 'text-text-faint'
                    }`}>
                      {source.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-line rounded-xl p-5">
              <p className="text-cyan text-[13px] font-semibold mb-1">이어하기</p>
              <h2 className="text-[20px] font-bold tracking-[-0.03em] text-text mb-4">최근 진행 항목</h2>
              {dashboard.recentActive.length === 0 ? (
                <p className="text-[13px] text-text-sub">진행 중인 분석이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {dashboard.recentActive.map((report) => (
                    <Link key={report.id} to={`/analysis/${report.id}`} className="block border border-line bg-bg px-4 py-3 hover:border-cyan/50 transition">
                      <p className="text-[13px] font-bold text-text truncate">{report.reportTitle || report.productName}</p>
                      <p className="text-[11px] text-text-faint mt-1">{STATUS[report.status]?.label || report.status} · {daysSince(report.createdAt)}일 전</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white border border-line rounded-xl p-5">
              <p className="text-green text-[13px] font-semibold mb-1">시장 신호</p>
              <h2 className="text-[20px] font-bold tracking-[-0.03em] text-text mb-4">자주 추천된 국가</h2>
              {dashboard.topCountries.length === 0 ? (
                <p className="text-[13px] text-text-sub">완료된 분석이 쌓이면 추천 국가가 표시됩니다.</p>
              ) : (
                <div className="space-y-3">
                  {dashboard.topCountries.map(([country, count]) => (
                    <div key={country} className="flex items-center justify-between gap-4">
                      <span className="text-[13px] font-semibold text-text">{country}</span>
                      <span className="text-[12px] text-text-sub">{count}회</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}

      <section className="bg-white border border-line rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-line">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-green text-[13px] font-semibold mb-1">리포트</p>
              <h2 className="text-[22px] font-bold tracking-[-0.03em] text-text">분석 목록</h2>
            </div>
            <form onSubmit={submitSearch} className="flex gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제품명 또는 리포트 검색" className="w-full lg:w-[280px] h-10 px-4 bg-bg border border-line text-[13px] focus:outline-none focus:border-green" />
              <button className="h-10 px-4 bg-white border border-line text-[13px] font-semibold text-text-sub cursor-pointer hover:border-green">검색</button>
              {query && <button type="button" onClick={() => { setQuery(''); loadReports(''); }} className="h-10 px-3 text-[12px] text-text-faint cursor-pointer">초기화</button>}
            </form>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            {[
              ['all', '전체', reports.length],
              ['action', '처리 필요', reports.filter((report) => report.status === 'FAILED' || report.status === 'HS_CODE_ESTIMATED' || hasSourceIssue(report) || openChecklist(report).length > 0).length],
              ['progress', '진행 중', reports.filter((report) => ['PENDING', 'HS_CODE_ESTIMATED', 'HS_CODE_CONFIRMED', 'ANALYZING'].includes(report.status)).length],
              ['completed', '완료', dashboard.completed],
            ].map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => changeView(key)}
                className={`h-9 px-4 border text-[12px] font-semibold transition ${
                  activeView === key ? 'bg-[#173b5d] text-white border-[#173b5d]' : 'bg-white text-text-sub border-line hover:border-green'
                }`}
              >
                {label} {count}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="py-20 flex justify-center">
            <div className="w-5 h-5 border-2 border-line border-t-green rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="m-6 border border-red/30 bg-red/5 px-5 py-4 text-[13px] text-red">
            {error}
          </div>
        )}

        {!loading && !error && reports.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-12 h-12 mx-auto mb-5 rounded-lg bg-bg text-green flex items-center justify-center text-[22px]">＋</div>
            <p className="text-[20px] font-semibold text-text">등록된 분석 내역이 없습니다.</p>
            <p className="text-text-sub text-[14px] mt-2 mb-8">새 분석을 시작하여 수출 관련 정보를 확인하세요.</p>
            <Link to="/analysis/new" className="h-11 px-6 bg-text text-white text-[13px] font-bold inline-flex items-center hover:bg-[#203454] transition-colors">
              새 분석 시작
            </Link>
          </div>
        )}

        {!loading && !error && reports.length > 0 && filteredReports.length === 0 && (
          <div className="py-14 text-center text-[14px] text-text-sub">현재 필터에 해당하는 리포트가 없습니다.</div>
        )}

        {!loading && !error && filteredReports.length > 0 && (
          <>
            <div className="responsive-table-head grid grid-cols-[1fr_120px_130px_80px_90px] bg-bg px-6 py-3.5 text-[11px] font-bold text-text-faint uppercase tracking-[0.12em]">
              <span>제품명</span>
              <span>HS코드</span>
              <span>다음 행동</span>
              <span>등급</span>
              <span className="text-right">날짜</span>
            </div>

            {filteredReports.map((report) => {
              const st = STATUS[report.status] ?? { label: report.status, dot: 'bg-text-faint' };
              const checklist = report.actionChecklist ?? [];
              const completedTasks = checklist.filter((item) => item.completed).length;
              const sourceIssue = hasSourceIssue(report);
              const nextAction = report.status === 'FAILED'
                ? '재분석'
                : report.status === 'HS_CODE_ESTIMATED'
                  ? 'HS 선택'
                  : sourceIssue
                    ? '출처 확인'
                    : checklist.length
                      ? `체크 ${completedTasks}/${checklist.length}`
                      : st.label;

              return (
                <div
                  key={report.id}
                  onClick={() => navigate(`/analysis/${report.id}`)}
                  className="responsive-table-row grid grid-cols-[1fr_120px_130px_80px_90px] px-6 py-5 border-t border-line/70 items-center cursor-pointer hover:bg-bg-hover transition-colors"
                >
                  <span className="text-[14px] font-medium text-text truncate pr-4 flex items-start gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCompare(report.id);
                      }}
                      className={`mt-0.5 w-4 h-4 border rounded-sm inline-flex items-center justify-center shrink-0 ${
                        compareIds.includes(report.id) ? 'bg-green border-green' : 'bg-white border-line'
                      }`}
                      aria-label="비교 선택"
                    >
                      {compareIds.includes(report.id) && <span className="text-[10px] text-white leading-none">✓</span>}
                    </button>
                    <span className="truncate">
                      {report.reportTitle || report.productName}
                      <span className="block text-[11px] font-normal text-text-faint mt-1 truncate">{report.productName}</span>
                    </span>
                  </span>
                  <span className="text-[13px] font-mono text-text-sub">{confirmedHs(report) || '—'}</span>
                  <span className="flex items-center gap-2 text-[13px] text-text-sub">
                    <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                    {nextAction}
                  </span>
                  <span>
                    {report.overallGrade
                      ? <span className={`text-[18px] font-serif font-bold ${GRADE_COLOR[report.overallGrade]}`}>{report.overallGrade}</span>
                      : <span className="text-[13px] text-text-faint">—</span>
                    }
                  </span>
                  <span className="text-[12px] text-text-faint text-right">{fmtDate(report.createdAt)}</span>
                </div>
              );
            })}
          </>
        )}
      </section>

      {topCompare.length === 2 && (
        <ComparePanel reports={topCompare} onClear={() => setCompareIds([])} />
      )}
    </div>
  );
}

function SummaryCard({ label, value, note, tone, to }) {
  const content = (
    <>
      <p className="text-[12px] font-semibold text-text-sub mb-3">{label}</p>
      <div className="flex items-end justify-between gap-4">
        <strong className={`text-[30px] leading-none ${tone}`}>{value}</strong>
        <span className="text-[11px] text-text-faint text-right">{note}</span>
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="bg-white border border-line rounded-xl px-5 py-5 hover:border-green/50 hover:bg-bg-hover transition">
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-white border border-line rounded-xl px-5 py-5">
      {content}
    </div>
  );
}

function DashboardNotice({ tone, title, text, action, to, onClick }) {
  const toneClass = {
    cyan: 'border-cyan/30 bg-cyan/5 text-cyan',
    yellow: 'border-yellow/30 bg-yellow/5 text-yellow',
    orange: 'border-orange/30 bg-orange/5 text-orange',
  }[tone] || 'border-line bg-white text-text-sub';
  const content = (
    <>
      <div>
        <p className={`text-[13px] font-bold mb-2 ${toneClass.split(' ').at(-1)}`}>{title}</p>
        <p className="text-[13px] text-text-sub leading-relaxed line-clamp-2">{text}</p>
      </div>
      <span className="mt-4 h-9 px-4 bg-white border border-line text-[12px] font-bold text-text-sub inline-flex items-center justify-center">
        {action}
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`border rounded-xl p-5 hover:bg-white transition ${toneClass}`}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`text-left border rounded-xl p-5 hover:bg-white transition ${toneClass}`}>
      {content}
    </button>
  );
}

function ComparePanel({ reports, onClear }) {
  return (
    <section className="bg-white border border-line rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-green text-[13px] font-semibold mb-2">비교</p>
          <h2 className="text-[24px] font-bold tracking-[-0.03em] text-text">선택한 두 리포트</h2>
        </div>
        <button type="button" onClick={onClear} className="h-9 px-4 bg-white border border-line text-[12px] font-semibold text-text-sub">
          선택 해제
        </button>
      </div>

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[720px] text-left text-[12px] bg-white">
          <thead className="bg-bg text-text-faint">
            <tr>
              <th className="p-3">항목</th>
              <th className="p-3">{reports[0].reportTitle || reports[0].productName}</th>
              <th className="p-3">{reports[1].reportTitle || reports[1].productName}</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['제품명', reports[0].productName, reports[1].productName],
              ['희망 수출국', reports[0].targetCountries || '—', reports[1].targetCountries || '—'],
              ['확정 HS코드', confirmedHs(reports[0]) || '—', confirmedHs(reports[1]) || '—'],
              ['종합 등급', reports[0].overallGrade || '—', reports[1].overallGrade || '—'],
              ['상태', STATUS[reports[0].status]?.label || reports[0].status, STATUS[reports[1].status]?.label || reports[1].status],
              ['체크리스트 완료', `${(reports[0].actionChecklist ?? []).filter((item) => item.completed).length}/${(reports[0].actionChecklist ?? []).length}`, `${(reports[1].actionChecklist ?? []).filter((item) => item.completed).length}/${(reports[1].actionChecklist ?? []).length}`],
            ].map(([label, left, right]) => (
              <tr key={label} className="border-t border-line">
                <td className="p-3 font-semibold text-text-sub">{label}</td>
                <td className="p-3">{left}</td>
                <td className="p-3">{right}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
