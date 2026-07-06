import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api/client';

const GRADE_TONE = {
  A: 'text-green bg-green/10 border-green/20',
  B: 'text-cyan bg-cyan/10 border-cyan/20',
  C: 'text-yellow bg-yellow/10 border-yellow/20',
  D: 'text-red bg-red/10 border-red/20',
};

function fmtDate(value) {
  if (!value) return '날짜 없음';
  return new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
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

function useReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/analysis')
      .then((data) => setReports(data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { reports, loading, error };
}

export function ActionRequiredPage() {
  const { reports, loading, error } = useReports();
  const actionItems = useMemo(() => {
    return reports.flatMap((report) => {
      const items = [];
      if (report.status === 'FAILED') {
        items.push({
          key: `failed-${report.id}`,
          label: '재분석',
          tone: 'text-red bg-red/5 border-red/30',
          title: report.reportTitle || report.productName,
          detail: report.failureMessage || '분석이 실패했습니다. 리포트에서 재분석을 시도하세요.',
          report,
        });
      }
      if (report.status === 'HS_CODE_ESTIMATED') {
        items.push({
          key: `hs-${report.id}`,
          label: 'HS 선택',
          tone: 'text-yellow bg-yellow/5 border-yellow/30',
          title: report.reportTitle || report.productName,
          detail: 'HS코드 후보를 선택해야 시장·위험 분석으로 넘어갈 수 있습니다.',
          report,
        });
      }
      if (hasSourceIssue(report)) {
        items.push({
          key: `source-${report.id}`,
          label: '출처 확인',
          tone: 'text-orange bg-orange/5 border-orange/30',
          title: report.reportTitle || report.productName,
          detail: report.dataStale ? '조회 후 시간이 지나 데이터 재확인이 필요합니다.' : '일부 데이터 출처가 데모 또는 실패 상태입니다.',
          report,
        });
      }
      openChecklist(report).slice(0, 3).forEach((task) => {
        items.push({
          key: `task-${report.id}-${task.id}`,
          label: '체크리스트',
          tone: 'text-cyan bg-cyan/5 border-cyan/30',
          title: task.title || task.task || task.description || '실행 항목 확인',
          detail: report.reportTitle || report.productName,
          report,
        });
      });
      return items;
    });
  }, [reports]);

  return (
    <WorkspaceShell
      eyebrow="처리 필요"
      title="지금 막힌 업무만 모았습니다"
      desc="실패, HS코드 선택 대기, 출처 확인, 미완료 체크리스트를 카드로 분리했습니다."
      loading={loading}
      error={error}
    >
      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <aside className="bg-white border border-line rounded-xl p-6 h-fit">
          <p className="text-[13px] font-bold text-text-sub mb-5">업무 요약</p>
          <div className="space-y-4">
            <Metric label="처리 카드" value={actionItems.length} tone="text-orange" />
            <Metric label="실패 리포트" value={reports.filter((report) => report.status === 'FAILED').length} tone="text-red" />
            <Metric label="HS 선택 대기" value={reports.filter((report) => report.status === 'HS_CODE_ESTIMATED').length} tone="text-yellow" />
            <Metric label="출처 확인" value={reports.filter(hasSourceIssue).length} tone="text-cyan" />
          </div>
        </aside>

        {actionItems.length === 0 ? (
          <EmptyPanel title="처리할 항목이 없습니다" text="현재 실패, 출처 확인, HS 선택 대기 상태의 리포트가 없습니다." />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {actionItems.map((item) => (
              <Link key={item.key} to={`/analysis/${item.report.id}`} className={`border rounded-xl p-5 bg-white hover:translate-y-[-2px] hover:shadow-[0_18px_45px_rgba(23,59,93,0.08)] transition ${item.tone}`}>
                <div className="flex items-center justify-between gap-4 mb-6">
                  <span className="h-8 px-3 rounded-lg bg-white/70 border border-current/20 text-[12px] font-bold inline-flex items-center">{item.label}</span>
                  <span className="text-[12px] text-text-faint">{fmtDate(item.report.createdAt)}</span>
                </div>
                <h2 className="text-[18px] font-black tracking-[-0.03em] text-text mb-3 line-clamp-2">{item.title}</h2>
                <p className="text-[13px] leading-[1.7] text-text-sub line-clamp-3">{item.detail}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

export function ProgressReportsPage() {
  const { reports, loading, error } = useReports();
  const columns = [
    ['PENDING', '초안', '아직 분석을 시작하지 않은 항목'],
    ['HS_CODE_ESTIMATED', 'HS 선택', '후보 중 하나를 확정해야 하는 항목'],
    ['HS_CODE_CONFIRMED', '분석 대기', 'HS코드가 확정되어 분석을 이어갈 항목'],
    ['ANALYZING', '분석 중', '백그라운드 조회가 진행 중인 항목'],
  ];

  return (
    <WorkspaceShell
      eyebrow="진행 중"
      title="분석 단계별 작업 보드"
      desc="완료 전 리포트를 단계별 칸반 보드로 나눠서 이어서 처리합니다."
      loading={loading}
      error={error}
    >
      <div className="grid xl:grid-cols-4 md:grid-cols-2 gap-4">
        {columns.map(([status, title, desc]) => {
          const items = reports.filter((report) => report.status === status);
          return (
            <section key={status} className="bg-white border border-line rounded-xl overflow-hidden">
              <div className="px-5 py-4 bg-bg border-b border-line">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[17px] font-black text-text">{title}</h2>
                  <span className="text-[12px] font-bold text-text-sub">{items.length}</span>
                </div>
                <p className="text-[12px] text-text-faint mt-2 leading-relaxed">{desc}</p>
              </div>
              <div className="p-4 space-y-3 min-h-[280px]">
                {items.length === 0 ? (
                  <p className="text-[13px] text-text-faint py-4">해당 단계의 리포트가 없습니다.</p>
                ) : items.map((report) => (
                  <Link key={report.id} to={`/analysis/${report.id}`} className="block bg-white border border-line rounded-lg p-4 hover:border-cyan/50 hover:bg-bg-hover transition">
                    <p className="text-[14px] font-bold text-text line-clamp-2">{report.reportTitle || report.productName}</p>
                    <p className="text-[12px] text-text-sub mt-3">HS {confirmedHs(report) || '미확정'}</p>
                    <p className="text-[11px] text-text-faint mt-1">{fmtDate(report.createdAt)}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </WorkspaceShell>
  );
}

export function CompletedReportsPage() {
  const { reports, loading, error } = useReports();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('latest');
  const completedReports = useMemo(() => {
    const filtered = reports
      .filter((report) => report.status === 'COMPLETED')
      .filter((report) => {
        const text = `${report.reportTitle || ''} ${report.productName || ''} ${confirmedHs(report)} ${report.targetCountries || ''}`.toLowerCase();
        return text.includes(query.trim().toLowerCase());
      });
    return [...filtered].sort((a, b) => {
      if (sort === 'grade') return String(a.overallGrade || 'Z').localeCompare(String(b.overallGrade || 'Z'));
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [reports, query, sort]);

  return (
    <WorkspaceShell
      eyebrow="완료 리포트"
      title="분석 결과 아카이브"
      desc="완료된 수출 분석을 검색하고 다시 열람합니다. 공유와 인쇄는 리포트 상세에서 진행합니다."
      loading={loading}
      error={error}
    >
      <div className="bg-white border border-line rounded-xl p-5 mb-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제품명, HS코드, 수출국으로 검색"
            className="flex-1 h-12 px-4 bg-bg border border-line text-[14px] focus:outline-none focus:border-cyan"
          />
          <div className="flex gap-2">
            {[
              ['latest', '최신순'],
              ['grade', '등급순'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={`h-12 px-5 border text-[13px] font-bold ${sort === key ? 'bg-[#173b5d] text-white border-[#173b5d]' : 'bg-white text-text-sub border-line'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {completedReports.length === 0 ? (
        <EmptyPanel title="완료 리포트가 없습니다" text="분석을 완료하면 이 화면에서 다시 모아볼 수 있습니다." />
      ) : (
        <div className="space-y-4">
          {completedReports.map((report) => {
            const gradeClass = GRADE_TONE[report.overallGrade] || 'text-text-faint bg-bg border-line';
            return (
              <Link key={report.id} to={`/analysis/${report.id}`} className="grid md:grid-cols-[1fr_auto] gap-4 bg-white border border-line rounded-xl p-6 hover:border-cyan/50 hover:bg-bg-hover transition">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="h-8 px-3 rounded-lg bg-cyan/10 text-cyan text-[12px] font-bold inline-flex items-center">수출 분석</span>
                    {report.sharingEnabled && <span className="h-8 px-3 rounded-lg bg-green/10 text-green text-[12px] font-bold inline-flex items-center">공유 중</span>}
                  </div>
                  <h2 className="text-[20px] font-black tracking-[-0.03em] text-text mb-3">{report.reportTitle || report.productName}</h2>
                  <p className="text-[14px] text-text-sub line-clamp-2">{report.productDescription || '제품 설명 없음'}</p>
                  <p className="text-[12px] text-text-faint mt-4">HS {confirmedHs(report) || '미확정'} · {report.targetCountries || '희망 수출국 없음'} · {fmtDate(report.createdAt)}</p>
                </div>
                <div className="md:text-right flex md:block items-center justify-between gap-4">
                  <span className={`h-12 min-w-12 px-4 rounded-xl border text-[20px] font-black inline-flex items-center justify-center ${gradeClass}`}>
                    {report.overallGrade || '-'}
                  </span>
                  <p className="text-[12px] text-text-faint md:mt-5">상세 열기</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </WorkspaceShell>
  );
}

function WorkspaceShell({ eyebrow, title, desc, loading, error, children }) {
  return (
    <div>
      <section className="bg-[#edf4f6] border border-line rounded-xl px-6 md:px-9 py-9 mb-8">
        <p className="text-cyan text-[13px] font-bold mb-3">{eyebrow}</p>
        <h1 className="text-[34px] md:text-[42px] font-black tracking-[-0.04em] text-text mb-4">{title}</h1>
        <p className="text-[15px] leading-relaxed text-text-sub max-w-[760px]">{desc}</p>
      </section>
      {loading && <div className="py-20 flex justify-center"><div className="w-5 h-5 border-2 border-line border-t-cyan rounded-full animate-spin" /></div>}
      {!loading && error && <div className="border border-red/30 bg-red/5 px-5 py-4 text-[13px] text-red">{error}</div>}
      {!loading && !error && children}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-3 last:border-b-0 last:pb-0">
      <span className="text-[13px] text-text-sub">{label}</span>
      <strong className={`text-[22px] leading-none ${tone}`}>{value}</strong>
    </div>
  );
}

function EmptyPanel({ title, text }) {
  return (
    <div className="bg-white border border-line rounded-xl px-6 py-16 text-center">
      <p className="text-[20px] font-black text-text mb-3">{title}</p>
      <p className="text-[14px] text-text-sub">{text}</p>
    </div>
  );
}
