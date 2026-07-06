import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiDelete, apiGet, apiPatch, apiPost, apiPublicGet } from '../api/client';

const GRADE = {
  A: { color: 'text-green',  bg: 'bg-green/5 border-green/30', label: '검토 우선순위 높음', desc: '현재 확인된 지표가 비교적 양호해 후속 검토를 우선 진행할 수 있어.' },
  B: { color: 'text-cyan',   bg: 'bg-cyan/5 border-cyan/30',   label: '조건부 검토', desc: '일부 위험요인이 있어 대응 방안을 확인한 뒤 진행해야 해.' },
  C: { color: 'text-yellow',  bg: 'bg-yellow/5 border-yellow/30', label: '주의 검토', desc: '여러 위험요인을 추가 확인한 뒤 의사결정해야 해.' },
  D: { color: 'text-red',    bg: 'bg-red/5 border-red/30',     label: '전문가 확인 우선', desc: '중요한 규제 또는 위험 가능성이 있어 전문가 확인이 우선이야.' },
};

const RISK_STYLE = {
  '낮음':     { color: 'text-green',  bg: 'bg-green/10' },
  '보통':     { color: 'text-yellow', bg: 'bg-yellow/10' },
  '높음':     { color: 'text-orange', bg: 'bg-orange/10' },
  '매우 높음': { color: 'text-red',   bg: 'bg-red/10' },
};

function fmtDate(s) {
  if (!s) return '';
  return new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function Section({ title, source, color = 'text-green', children }) {
  return (
    <section className="mb-14">
      <div className="flex items-end justify-between mb-6">
        <h2 className={`text-[13px] font-bold uppercase tracking-[0.2em] ${color}`}>{title}</h2>
        {source && (
          <span className="text-[11px] text-text-faint italic">
            출처: {source}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function ScoreBar({ value, max = 100, color = 'bg-green' }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-2 bg-line/50 rounded-full overflow-hidden mt-2">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Meta({ label, value, link = false }) {
  if (!value) return null;
  return (
    <div className="bg-white border border-line p-4">
      <p className="text-[10px] font-bold text-text-faint mb-1">{label}</p>
      {link
        ? <a href={value} target="_blank" rel="noreferrer" className="text-[12px] text-green break-all hover:underline">자료 열기 ↗</a>
        : <p className="text-[13px] text-text leading-relaxed">{value}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const style = {
    LIVE: 'text-green bg-green/10',
    DEMO: 'text-yellow bg-yellow/10',
    FAILED: 'text-red bg-red/10',
  }[status] ?? 'text-text-faint bg-bg';
  const label = { LIVE: '실데이터', DEMO: '확인 필요', FAILED: '실패' }[status] ?? '확인 전';
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${style}`}>{label}</span>;
}

export default function AnalysisResult({ shared = false }) {
  const { id, token } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [selectedHs, setSelectedHs] = useState('');
  const [strategyReport, setStrategyReport] = useState(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [simulator, setSimulator] = useState({
    unitPrice: '',
    unitCost: '',
    logisticsCost: '',
    quantity: '1000',
  });
  const currentStatus = report?.status;

  useEffect(() => {
    const request = shared
      ? apiPublicGet(`/public/reports/${token}`)
      : apiGet(`/analysis/${id}`);
    request
      .then(setReport)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, token, shared]);

  useEffect(() => {
    if (shared || currentStatus !== 'ANALYZING') return undefined;
    const timer = window.setInterval(() => {
      apiGet(`/analysis/${id}`)
        .then(setReport)
        .catch((e) => setActionMessage(e.message));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [id, currentStatus, shared]);

  async function renameReport() {
    const nextTitle = window.prompt('새 리포트 이름을 입력해줘.', report.reportTitle || report.productName);
    if (!nextTitle?.trim()) return;
    try {
      setActionLoading(true);
      setReport(await apiPatch(`/analysis/${id}`, { reportTitle: nextTitle.trim() }));
    } catch (e) {
      setActionMessage(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function reanalyze() {
    if (!window.confirm('기존 시장·위험 결과를 새 데이터로 다시 분석할까?')) return;
    try {
      setActionLoading(true);
      setActionMessage('재분석 중이야. 외부 데이터 조회에 시간이 걸릴 수 있어.');
      setReport(await apiPost(`/analysis/${id}/reanalyze`));
      setActionMessage('재분석을 완료했어.');
    } catch (e) {
      setActionMessage(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteReport() {
    if (!window.confirm('이 리포트를 삭제할까? 삭제 후에는 복구할 수 없어.')) return;
    try {
      setActionLoading(true);
      await apiDelete(`/analysis/${id}`);
      navigate('/');
    } catch (e) {
      setActionMessage(e.message);
      setActionLoading(false);
    }
  }

  async function toggleShare() {
    try {
      setActionLoading(true);
      if (report.sharingEnabled) {
        await apiDelete(`/analysis/${id}/share`);
        setReport((prev) => ({ ...prev, sharingEnabled: false, shareToken: null }));
        setActionMessage('공유 링크를 해제했어.');
      } else {
        const data = await apiPost(`/analysis/${id}/share`);
        const url = `${window.location.origin}/shared/${data.token}`;
        setReport((prev) => ({ ...prev, sharingEnabled: true, shareToken: data.token }));
        await navigator.clipboard?.writeText(url);
        setActionMessage(`공유 링크를 만들었어: ${url}`);
      }
    } catch (e) {
      setActionMessage(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleChecklist(item) {
    try {
      const updated = await apiPatch(`/analysis/${id}/checklist/${item.id}`, { completed: !item.completed });
      setReport((prev) => ({
        ...prev,
        actionChecklist: prev.actionChecklist.map((entry) => entry.id === item.id ? updated : entry),
      }));
    } catch (e) {
      setActionMessage(e.message);
    }
  }

  async function continueAnalysis() {
    if (!selectedHs) return;
    try {
      setActionLoading(true);
      setActionMessage('시장·위험·규제 데이터를 조회하고 있어.');
      setReport(await apiPost(`/analysis/${id}/confirm`, { hsCode: selectedHs }));
      setActionMessage('종합 분석을 완료했어.');
    } catch (e) {
      setActionMessage(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function loadStrategyReport() {
    try {
      setStrategyLoading(true);
      setStrategyReport(await apiGet(`/analysis/${id}/strategy`));
      setActionMessage('전략 보고서를 불러왔어.');
    } catch (e) {
      setActionMessage(e.message);
    } finally {
      setStrategyLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="py-32 flex justify-center">
        <div className="w-5 h-5 border-2 border-line border-t-green rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-32 text-center">
        <p className="text-red font-serif italic text-[14px] mb-4">{error}</p>
        <Link to="/" className="text-[13px] text-text-sub hover:text-text transition-colors">← 목록으로</Link>
      </div>
    );
  }

  const {
    reportTitle, productName, productDescription, material, intendedUse, specifications,
    processingState, targetCountries, referenceUrl, status, failureMessage,
    specFileName, specFileType, specFileText,
    overallGrade, reportSummary, createdAt,
    hsCodes = [], marketRecommendations = [], riskAssessments = [],
    strategicItem, dataSources = [], dataSourceStatuses = [], dataRetrievedAt, dataStale,
    actionChecklist = [], disclaimer,
  } = report;

  const confirmedHs = hsCodes.find((h) => h.confirmed);
  const g = overallGrade ? GRADE[overallGrade] : null;
  const comparison = marketRecommendations.map((market) => ({
    ...market,
    risk: riskAssessments.find((risk) => risk.countryCode === market.countryCode),
  }));
  const completedTasks = actionChecklist.filter((item) => item.completed).length;

  return (
    <div className={`max-w-[980px] mx-auto ${shared ? 'py-10 px-5' : ''}`}>
      {/* 뒤로가기 */}
      {!shared && <Link to="/" className="text-[13px] text-text-sub hover:text-text transition-colors mb-8 inline-block">← 목록으로</Link>}

      {!shared && (
        <div className="flex flex-wrap gap-2 mb-8 print:hidden">
          <button onClick={() => window.print()} className="h-9 px-4 bg-white border border-line text-[12px] font-semibold cursor-pointer">PDF로 인쇄</button>
          <button onClick={renameReport} disabled={actionLoading} className="h-9 px-4 bg-white border border-line text-[12px] font-semibold cursor-pointer disabled:opacity-40">이름 변경</button>
          <button onClick={reanalyze} disabled={actionLoading || !confirmedHs} className="h-9 px-4 bg-white border border-line text-[12px] font-semibold cursor-pointer disabled:opacity-40">재분석</button>
          <button onClick={loadStrategyReport} disabled={strategyLoading || actionLoading || status !== 'COMPLETED'} className="h-9 px-4 bg-white border border-line text-[12px] font-semibold cursor-pointer disabled:opacity-40">{strategyLoading ? '전략 생성 중...' : '전략 보고서'}</button>
          <button onClick={toggleShare} disabled={actionLoading} className="h-9 px-4 bg-white border border-line text-[12px] font-semibold cursor-pointer disabled:opacity-40">{report.sharingEnabled ? '공유 해제' : '읽기 전용 공유'}</button>
          <button onClick={deleteReport} disabled={actionLoading} className="h-9 px-4 bg-white border border-red/30 text-[12px] font-semibold text-red cursor-pointer disabled:opacity-40">삭제</button>
        </div>
      )}
      {actionMessage && <p className="text-[12px] text-text-sub bg-white border border-line px-4 py-3 mb-6 break-all print:hidden">{actionMessage}</p>}

      {/* 제목 & 메타 */}
      <p className="text-green text-[13px] font-semibold mb-2">{shared ? '공유된 수출 분석 결과' : '수출 분석 결과'}</p>
      <h1 className="text-[34px] md:text-[40px] font-bold tracking-[-0.04em] text-text leading-tight mb-1">{reportTitle || productName}</h1>
      {reportTitle && reportTitle !== productName && <p className="text-[13px] text-text-sub mb-3">제품명: {productName}</p>}
      <div className="flex items-center gap-4 mb-4">
        {confirmedHs && <span className="font-mono text-[13px] text-green font-bold px-2 py-0.5 bg-green/10 border border-green/20 rounded-sm">HS {confirmedHs.code}</span>}
        <span className="text-[13px] text-text-faint">{fmtDate(createdAt)}</span>
        {status === 'COMPLETED' && (
          <span className="text-[11px] text-green font-bold uppercase tracking-[0.15em] px-2 py-0.5 bg-green/10 border border-green/20 rounded-sm">분석 완료</span>
        )}
      </div>
      {productDescription && (
        <p className="text-[14px] text-text-sub leading-relaxed mb-6 max-w-[700px]">{productDescription}</p>
      )}

      {[material, intendedUse, specifications, processingState, targetCountries, referenceUrl].some(Boolean) && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
          <Meta label="주요 소재" value={material} />
          <Meta label="사용 목적" value={intendedUse} />
          <Meta label="제품 사양" value={specifications} />
          <Meta label="가공 상태" value={processingState} />
          <Meta label="희망 수출국" value={targetCountries} />
          <Meta label="참고 자료" value={referenceUrl} link />
          <Meta label="업로드 파일" value={specFileName} />
          <Meta label="파일 형식" value={specFileType} />
        </div>
      )}

      {specFileText && (
        <Section title="추출된 사양서 내용" source="업로드 파일 자동 추출" color="text-cyan">
          <div className="bg-white border border-line p-5 text-[13px] text-text-sub leading-relaxed whitespace-pre-wrap">
            {specFileText}
          </div>
        </Section>
      )}

      {dataSourceStatuses.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-bold text-text-sub">데이터 조회 상태</p>
            {dataRetrievedAt && <span className="text-[11px] text-text-faint">조회: {fmtDate(dataRetrievedAt)}</span>}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {dataSourceStatuses.map((source) => (
              <a key={source.key} href={source.url} target="_blank" rel="noreferrer" className={`border p-3 bg-white ${source.status === 'DEMO' ? 'border-yellow/40' : 'border-line'}`}>
                <div className="flex items-center justify-between mb-1"><span className="text-[12px] font-bold text-text">{source.name}</span><StatusBadge status={source.status} /></div>
                {source.message && <p className="text-[10px] leading-relaxed text-text-faint">{source.message}</p>}
              </a>
            ))}
          </div>
          {dataSourceStatuses.some((source) => source.status === 'DEMO') && (
            <p className="mt-3 text-[12px] text-yellow bg-yellow/5 border border-yellow/30 px-4 py-3">일부 데이터는 확인이 더 필요해. 원본 출처를 한 번 더 확인해줘.</p>
          )}
          {dataStale && (
            <p className="mt-3 text-[12px] text-orange bg-orange/5 border border-orange/30 px-4 py-3">조회 후 30일이 지났어. 관세·규제 정보가 바뀌었을 수 있으니 재분석해줘.</p>
          )}
        </div>
      )}

      {status === 'ANALYZING' && (
        <div className="mb-10 border border-cyan/30 bg-cyan/5 p-6 flex items-center gap-4">
          <span className="w-5 h-5 border-2 border-line border-t-cyan rounded-full animate-spin shrink-0" />
          <div><p className="text-[14px] font-bold text-text">백그라운드 분석 중</p><p className="text-[12px] text-text-sub mt-1">시장·위험·규제와 AI 종합 리포트를 확인하고 있어. 완료되면 자동으로 갱신돼.</p></div>
        </div>
      )}

      {status === 'FAILED' && (
        <div className="mb-10 border border-red/30 bg-red/5 p-6">
          <p className="text-[14px] font-bold text-red mb-1">분석을 완료하지 못했어.</p>
          <p className="text-[12px] text-text-sub">{failureMessage || '외부 데이터 조회 중 오류가 발생했어.'}</p>
          {!shared && <button onClick={reanalyze} disabled={actionLoading} className="mt-4 h-9 px-4 bg-white border border-red/30 text-[12px] font-bold text-red cursor-pointer">재분석 시도</button>}
        </div>
      )}

      {/* ── 종합 등급 카드 ── */}
      {status === 'COMPLETED' && g && (
        <div className={`border rounded-xl p-6 md:p-8 mb-12 ${g.bg}`}>
          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="text-center shrink-0 min-w-[120px]">
              <p className="text-[10px] font-bold text-text-faint uppercase tracking-[0.2em] mb-3">종합등급</p>
              <p className={`text-[80px] font-black leading-none ${g.color}`}>{overallGrade}</p>
              <p className={`text-[14px] font-bold mt-3 ${g.color}`}>{g.label}</p>
            </div>
            <div className="flex-1 pt-2 md:border-l border-line md:pl-8">
              <p className="text-text-sub text-[15px] leading-relaxed mb-4">{g.desc}</p>
              {reportSummary && (
                <div className="bg-bg-card rounded-lg p-6">
                  <p className="text-[12px] font-semibold text-text-faint mb-3">종합 분석 요약</p>
                  {reportSummary.split('\n').map((line, i) => {
                    if (!line.trim()) return <br key={i} />;
                    if (line.startsWith('■')) {
                      return <p key={i} className="text-[14px] font-bold text-green mt-4 mb-2">{line}</p>;
                    }
                    return <p key={i} className="text-[14px] text-text leading-[1.8] mb-1">{line}</p>;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {status === 'COMPLETED' && (
        <section className="mb-14">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.2em] text-green">원클릭 수출 가능성 분석</h2>
              <p className="text-[13px] text-text-sub mt-2">현재 결과를 한눈에 보는 요약이야. 필요한 경우 아래 전략 보고서와 시뮬레이터를 더 보자.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="bg-white border border-line p-5">
              <p className="text-[11px] text-text-faint uppercase tracking-[0.15em] mb-2">수출 가능성 점수</p>
              <p className="text-[34px] font-black text-green">{g ? ({ A: 90, B: 75, C: 58, D: 35 }[overallGrade] ?? 50) : 50}</p>
              <p className="text-[12px] text-text-sub mt-2">등급과 데이터 상태를 합쳐서 본 빠른 판단 점수야.</p>
            </div>
            <div className="bg-white border border-line p-5">
              <p className="text-[11px] text-text-faint uppercase tracking-[0.15em] mb-2">추천 우선순위</p>
              <p className="text-[18px] font-bold text-text">{comparison[0]?.countryName || '데이터 확인 중'}</p>
              <p className="text-[12px] text-text-sub mt-2">시장성, 관세, 위험도를 종합한 첫 번째 후보야.</p>
            </div>
            <div className="bg-white border border-line p-5">
              <p className="text-[11px] text-text-faint uppercase tracking-[0.15em] mb-2">실무 상태</p>
              <p className="text-[18px] font-bold text-text">{dataSourceStatuses.some((source) => source.status === 'DEMO') ? '확인 필요' : '실데이터 중심'}</p>
              <p className="text-[12px] text-text-sub mt-2">지금 결과를 바로 의사결정에 쓰기 전에 출처 상태를 먼저 봐야 해.</p>
            </div>
          </div>
        </section>
      )}

      {/* ── HS코드 ── */}
      {hsCodes.length > 0 && (
        <Section title="HS코드 추정 결과" source="자동 분류 모델" color="text-cyan">
          <div className="space-y-3">
            {hsCodes.map((hs) => {
              const pct = hs.confidence != null ? Math.round(hs.confidence * (hs.confidence > 1 ? 1 : 100)) : null;
              return (
                <button type="button" disabled={shared || status !== 'HS_CODE_ESTIMATED'} onClick={() => setSelectedHs(hs.code)} key={hs.id ?? hs.code} className={`w-full text-left p-5 border ${hs.confirmed || selectedHs === hs.code ? 'border-green/30 bg-green/5' : 'border-line bg-bg-card'} ${status === 'HS_CODE_ESTIMATED' && !shared ? 'cursor-pointer' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-text text-[16px]">{hs.code}</span>
                      {hs.confirmed && <span className="text-[10px] font-bold text-green uppercase tracking-wider px-2 py-0.5 bg-green/10 border border-green/20 rounded-sm">사용자 확정</span>}
                    </div>
                    {pct != null && (
                      <span className={`text-[13px] font-bold ${pct >= 70 ? 'text-green' : pct >= 50 ? 'text-yellow' : 'text-red'}`}>
                        신뢰도 {pct}%
                      </span>
                    )}
                  </div>
                  {hs.description && <p className="text-[14px] text-text-sub leading-relaxed">{hs.description}</p>}
                  {pct != null && <ScoreBar value={pct} color={pct >= 70 ? 'bg-green' : pct >= 50 ? 'bg-yellow' : 'bg-red'} />}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-text-faint italic mt-3">
            HS코드는 자동 추정값이며, 정확한 분류는 관세청 품목분류 사전심사(customs.go.kr)를 권장합니다.
          </p>
          {!shared && status === 'HS_CODE_ESTIMATED' && (
            <div className="mt-5 flex flex-wrap gap-3 items-center">
              <input value={selectedHs} onChange={(e) => setSelectedHs(e.target.value)} placeholder="후보 선택 또는 HS코드 직접 입력" className="h-11 flex-1 min-w-[260px] px-4 bg-white border border-line font-mono text-[13px] focus:outline-none focus:border-green" />
              <button onClick={continueAnalysis} disabled={!selectedHs || actionLoading} className="h-11 px-6 bg-[#173b5d] text-white text-[13px] font-bold disabled:opacity-40 cursor-pointer">{actionLoading ? '분석 중...' : '이 HS코드로 계속 분석'}</button>
            </div>
          )}
        </Section>
      )}

      {comparison.length > 0 && (
        <Section title="국가 한눈에 비교" source="KOTRA · 한국무역보험공사" color="text-green">
          <div className="overflow-x-auto border border-line bg-white">
            <table className="w-full min-w-[680px] text-left text-[13px]">
              <thead className="bg-bg text-text-faint text-[11px]">
                <tr><th className="p-3">국가</th><th className="p-3">시장 점수</th><th className="p-3">관세율</th><th className="p-3">FTA</th><th className="p-3">국가 위험</th><th className="p-3">신용등급</th></tr>
              </thead>
              <tbody>
                {comparison.map((item) => (
                  <tr key={item.countryCode} className="border-t border-line">
                    <td className="p-3 font-bold text-text">{item.countryName}</td>
                    <td className="p-3">{item.score ?? '—'}</td>
                    <td className="p-3">{item.tariffRate != null ? `${item.tariffRate}%` : '—'}</td>
                    <td className="p-3">{item.ftaApplied ? '적용 가능' : '확인 필요'}</td>
                    <td className="p-3">{item.risk?.riskGrade ?? '미평가'}</td>
                    <td className="p-3 font-mono">{item.risk?.creditRating ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-text-faint mt-2">점수와 관세율은 출처 상태와 기준일을 함께 확인해야 해.</p>
        </Section>
      )}

      {comparison.length > 0 && (
        <Section title="국가별 수출 시뮬레이터" source="시장성 + 관세 + 위험도 기반 추정" color="text-cyan">
          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <label className="bg-white border border-line p-3">
              <span className="block text-[11px] text-text-faint mb-1">판매단가</span>
              <input value={simulator.unitPrice} onChange={(e) => setSimulator((prev) => ({ ...prev, unitPrice: e.target.value }))} placeholder="예: 120" className="w-full h-10 px-3 border border-line text-[13px] focus:outline-none focus:border-green" />
            </label>
            <label className="bg-white border border-line p-3">
              <span className="block text-[11px] text-text-faint mb-1">원가</span>
              <input value={simulator.unitCost} onChange={(e) => setSimulator((prev) => ({ ...prev, unitCost: e.target.value }))} placeholder="예: 80" className="w-full h-10 px-3 border border-line text-[13px] focus:outline-none focus:border-green" />
            </label>
            <label className="bg-white border border-line p-3">
              <span className="block text-[11px] text-text-faint mb-1">물류/기타비용</span>
              <input value={simulator.logisticsCost} onChange={(e) => setSimulator((prev) => ({ ...prev, logisticsCost: e.target.value }))} placeholder="예: 8" className="w-full h-10 px-3 border border-line text-[13px] focus:outline-none focus:border-green" />
            </label>
            <label className="bg-white border border-line p-3">
              <span className="block text-[11px] text-text-faint mb-1">예상 수량</span>
              <input value={simulator.quantity} onChange={(e) => setSimulator((prev) => ({ ...prev, quantity: e.target.value }))} placeholder="예: 1000" className="w-full h-10 px-3 border border-line text-[13px] focus:outline-none focus:border-green" />
            </label>
          </div>

          <div className="overflow-x-auto border border-line bg-white">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="bg-bg text-text-faint text-[11px]">
                <tr>
                  <th className="p-3">국가</th>
                  <th className="p-3">시장성</th>
                  <th className="p-3">예상 관세</th>
                  <th className="p-3">리스크</th>
                  <th className="p-3">예상 이익</th>
                  <th className="p-3">최종 추천</th>
                </tr>
              </thead>
              <tbody>
                {comparison
                  .slice()
                  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                  .slice(0, 3)
                  .map((item, index) => {
                    const qty = Number(simulator.quantity || 0);
                    const price = Number(simulator.unitPrice || 0);
                    const cost = Number(simulator.unitCost || 0);
                    const logistics = Number(simulator.logisticsCost || 0);
                    const revenue = price * qty;
                    const baseCost = (cost + logistics) * qty;
                    const tariff = (revenue * (Number(item.tariffRate || 0) / 100));
                    const riskPenalty = item.risk?.riskGrade === '높음' ? revenue * 0.08 : item.risk?.riskGrade === '매우 높음' ? revenue * 0.12 : item.risk?.riskGrade === '보통' ? revenue * 0.04 : revenue * 0.02;
                    const profit = Math.round(revenue - baseCost - tariff - riskPenalty);
                    return (
                      <tr key={item.countryCode} className="border-t border-line">
                        <td className="p-3 font-bold text-text">{item.countryName}</td>
                        <td className="p-3">{item.score ?? '—'}</td>
                        <td className="p-3">{item.tariffRate != null ? `${item.tariffRate}%` : '—'}</td>
                        <td className="p-3">{item.risk?.riskGrade ?? '미평가'}</td>
                        <td className="p-3 font-mono">{Number.isFinite(profit) ? profit.toLocaleString('ko-KR') : '—'}</td>
                        <td className="p-3">{index === 0 ? '1위' : index === 1 ? '2위' : '3위'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-text-faint mt-2">이건 입력한 단가를 기준으로 한 추정치라서, 실제 운임/보험/통관비는 별도 확인이 필요해.</p>
        </Section>
      )}

      {strategyReport && (
        <Section title="AI 수출 전략 보고서" source="원클릭 생성" color="text-green">
          <div className="bg-white border border-line p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
              <div>
                <p className="text-[11px] text-text-faint uppercase tracking-[0.15em] mb-2">추천 진출국</p>
                <h3 className="text-[24px] font-bold text-text">{strategyReport.targetCountry || '미정'}</h3>
                <p className="text-[13px] text-text-sub mt-2">{strategyReport.entryReason}</p>
              </div>
              <div className="min-w-[140px] text-left sm:text-right">
                <p className="text-[11px] text-text-faint uppercase tracking-[0.15em] mb-2">전략 점수</p>
                <p className="text-[42px] font-black text-green">{strategyReport.exportScore ?? '—'}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-bg-card p-4 border border-line">
                <p className="text-[11px] text-text-faint uppercase tracking-[0.15em] mb-2">리스크 요약</p>
                <p className="text-[13px] text-text-sub leading-relaxed">{strategyReport.riskSummary}</p>
              </div>
              <div className="bg-bg-card p-4 border border-line">
                <p className="text-[11px] text-text-faint uppercase tracking-[0.15em] mb-2">결제 방식</p>
                <p className="text-[13px] text-text-sub leading-relaxed">{strategyReport.paymentMethod}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3 mt-4">
              <div className="border border-line p-4">
                <p className="text-[11px] text-text-faint uppercase tracking-[0.15em] mb-2">필요 인증</p>
                <ul className="space-y-2 text-[13px] text-text-sub">
                  {(strategyReport.certifications || []).map((item) => <li key={item}>- {item}</li>)}
                </ul>
              </div>
              <div className="border border-line p-4">
                <p className="text-[11px] text-text-faint uppercase tracking-[0.15em] mb-2">준비 서류</p>
                <ul className="space-y-2 text-[13px] text-text-sub">
                  {(strategyReport.documents || []).map((item) => <li key={item}>- {item}</li>)}
                </ul>
              </div>
              <div className="border border-line p-4">
                <p className="text-[11px] text-text-faint uppercase tracking-[0.15em] mb-2">30일 실행 계획</p>
                <ul className="space-y-2 text-[13px] text-text-sub">
                  {(strategyReport.thirtyDayPlan || []).map((item) => <li key={item}>- {item}</li>)}
                </ul>
              </div>
            </div>

            <div className="mt-4 bg-bg-card p-4 border border-line">
              <p className="text-[11px] text-text-faint uppercase tracking-[0.15em] mb-2">요약</p>
              <p className="text-[13px] text-text leading-relaxed whitespace-pre-wrap">{strategyReport.summary}</p>
            </div>
          </div>
        </Section>
      )}

      {/* ── 유망시장 추천 ── */}
      {marketRecommendations.length > 0 && (
        <Section title="유망시장 추천" source="KOTRA 해외시장뉴스 Open API" color="text-green">
          <div className="space-y-4">
            {marketRecommendations.map((m, i) => (
              <div key={m.id ?? m.countryCode} className="border border-line p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-bold text-bg bg-green w-7 h-7 rounded-full flex items-center justify-center">{i + 1}</span>
                    <span className="font-serif text-[22px] font-bold text-text">{m.countryName}</span>
                    {m.countryCode && <span className="text-[12px] font-mono text-text-faint bg-bg-dark px-2 py-0.5 rounded-sm">{m.countryCode}</span>}
                  </div>
                  {m.ftaApplied && (
                    <span className="text-[11px] font-bold text-teal uppercase tracking-wider px-3 py-1 bg-teal/10 border border-teal/20 rounded-sm">
                      FTA 적용
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6 mb-5">
                  {m.score != null && (
                    <div className="bg-bg-dark p-4 border border-line">
                      <p className="text-[10px] text-text-faint uppercase tracking-[0.15em] mb-1">KOTRA 유망도 점수</p>
                      <p className="font-serif text-[32px] font-bold text-text">{m.score}<span className="text-[14px] text-text-sub ml-1">/ 100</span></p>
                      <ScoreBar value={m.score} color="bg-green" />
                    </div>
                  )}
                  {m.tariffRate != null && (
                    <div className="bg-bg-dark p-4 border border-line">
                      <p className="text-[10px] text-text-faint uppercase tracking-[0.15em] mb-1">적용 관세율{m.ftaApplied ? ' (FTA)' : ''}</p>
                      <p className="font-serif text-[32px] font-bold text-text">{m.tariffRate}<span className="text-[14px] text-text-sub ml-1">%</span></p>
                      <ScoreBar value={Math.max(100 - m.tariffRate * 10, 0)} color="bg-teal" />
                    </div>
                  )}
                </div>

                {m.description && (
                  <p className="text-[14px] text-text-sub leading-[1.8]">{m.description}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 국가 리스크 평가 ── */}
      {riskAssessments.length > 0 && (
        <Section title="국가 리스크 평가" source="한국무역보험공사 국가신용도 API" color="text-yellow">
          <div className="space-y-4">
            {riskAssessments.map((r) => {
              const rk = RISK_STYLE[r.riskGrade] || { color: 'text-text-sub', bg: 'bg-bg-card' };
              return (
                <div key={r.id ?? r.countryCode} className="border border-line p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <span className="font-serif text-[22px] font-bold text-text">{r.countryName}</span>
                      {r.countryCode && <span className="text-[12px] font-mono text-text-faint bg-bg-dark px-2 py-0.5 rounded-sm">{r.countryCode}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {r.creditRating && (
                        <span className="text-[14px] font-mono font-bold text-text bg-bg-dark px-3 py-1 border border-line rounded-sm">
                          {r.creditRating}
                        </span>
                      )}
                      <span className={`text-[12px] font-bold px-3 py-1 rounded-sm ${rk.color} ${rk.bg}`}>
                        리스크 {r.riskGrade}
                      </span>
                    </div>
                  </div>
                  {r.description && (
                    <p className="text-[14px] text-text-sub leading-[1.8]">{r.description}</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-text-faint italic mt-3">
            신용등급은 한국무역보험공사 기준이며, Moody's·S&P 등 국제 신용평가사 등급과 다를 수 있습니다.
          </p>
        </Section>
      )}

      {/* ── 전략물자 판정 ── */}
      {strategicItem && (
        <Section title="전략물자 수출통제 확인" source="전략물자관리원 yesTrade HSK 연계표" color="text-orange">
          <div className={`border p-6 ${
            strategicItem.isStrategic ? 'border-red/30 bg-red/5' : 'border-green/30 bg-green/5'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-[16px] font-bold ${strategicItem.isStrategic ? 'text-red' : 'text-green'}`}>
                {strategicItem.isStrategic ? '전략물자 통제 가능성 확인' : 'HS코드 1차 검색에서 통제 항목 미확인'}
              </span>
              {strategicItem.category && (
                <span className="text-[12px] text-text-faint bg-bg-dark px-2 py-0.5 rounded-sm border border-line">
                  {strategicItem.category}
                </span>
              )}
            </div>
            {strategicItem.description && (
              <p className="text-[14px] text-text-sub leading-[1.8] mb-4">{strategicItem.description}</p>
            )}
          </div>
          {strategicItem.regulationDetail && (
            <div className="border border-line bg-bg-card p-6 mt-3">
              <p className="text-[11px] font-bold text-text-faint uppercase tracking-[0.15em] mb-3">관련 법령 및 유의사항</p>
              {strategicItem.regulationDetail.split('\n').map((line, i) => (
                <p key={i} className={`text-[13px] leading-[1.8] ${
                  line.startsWith('※') || line.startsWith('①') || line.startsWith('②') || line.startsWith('③') || line.startsWith('④')
                    ? 'text-text-sub mt-1'
                    : 'text-text-faint'
                }`}>
                  {line}
                </p>
              ))}
            </div>
          )}
        </Section>
      )}

      {actionChecklist.length > 0 && (
        <Section title={`수출 준비 체크리스트 ${completedTasks}/${actionChecklist.length}`} color="text-cyan">
          <div className="h-2 bg-line rounded-full overflow-hidden mb-5">
            <div className="h-full bg-green" style={{ width: `${(completedTasks / actionChecklist.length) * 100}%` }} />
          </div>
          <div className="space-y-2">
            {actionChecklist.map((item) => (
              <div key={item.id} className={`border p-4 flex gap-4 ${item.completed ? 'border-green/30 bg-green/5' : 'border-line bg-white'}`}>
                <button onClick={() => !shared && toggleChecklist(item)} disabled={shared} className={`w-6 h-6 shrink-0 border flex items-center justify-center text-[12px] ${item.completed ? 'bg-green border-green text-white' : 'border-line bg-bg'} ${shared ? '' : 'cursor-pointer'}`} aria-label={`${item.title} 완료 여부`}>
                  {item.completed ? '✓' : ''}
                </button>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <p className={`text-[14px] font-bold ${item.completed ? 'text-text-sub line-through' : 'text-text'}`}>{item.title}</p>
                    {item.officialUrl && <a href={item.officialUrl} target="_blank" rel="noreferrer" className="text-[11px] text-green hover:underline">공식 사이트 ↗</a>}
                  </div>
                  <p className="text-[12px] text-text-sub leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 데이터 출처 & 면책 조항 ── */}
      <div className="border-t border-line pt-8 mt-8 mb-8">
        {dataSources.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] font-bold text-text-faint uppercase tracking-[0.15em] mb-3">데이터 출처</p>
            <div className="grid grid-cols-2 gap-2">
              {dataSources.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px] text-text-sub bg-bg-card border border-line px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}
        {disclaimer && (
          <div className="bg-bg-dark border border-line p-5">
            <p className="text-[11px] font-bold text-text-faint uppercase tracking-[0.15em] mb-2">면책 조항</p>
            <p className="text-[13px] text-text-sub leading-[1.8]">{disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
