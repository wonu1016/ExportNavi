import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPatch, apiPost, apiUpload } from '../api/client';

const DRAFT_KEY = 'exportnavi.analysis.new.draft';
const DRAFT_PROMPT_KEY = 'exportnavi.analysis.new.draft.prompted';
const EMPTY_UPLOADED_FILE = { fileName: '', fileType: '', extractedText: '' };

export default function AnalysisNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [report, setReport] = useState(null);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [draftId, setDraftId] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [uploadedFile, setUploadedFile] = useState(EMPTY_UPLOADED_FILE);
  const [guidedMessages, setGuidedMessages] = useState([
    { role: 'assistant', message: '제품 정보를 적어주면 내가 부족한 걸 하나씩 물어볼게.' },
  ]);
  const [guidedLoading, setGuidedLoading] = useState(false);
  const [guidedReady, setGuidedReady] = useState(false);
  const [guidedCandidates, setGuidedCandidates] = useState([]);
  const [preflightWarning, setPreflightWarning] = useState(null);
  const [pendingAnalysisPayload, setPendingAnalysisPayload] = useState(null);
  const [details, setDetails] = useState({
    material: '', intendedUse: '', specifications: '', processingState: '',
    targetCountries: '', referenceUrl: '',
  });

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DRAFT_PROMPT_KEY) === '1') return;
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || (!draft.name && !draft.desc && !draft.details)) return;
      sessionStorage.setItem(DRAFT_PROMPT_KEY, '1');
      const shouldRestore = window.confirm('이전에 저장한 초안을 불러올까?');
      window.setTimeout(() => {
        if (shouldRestore) {
          setName(draft.name ?? '');
          setDesc(draft.desc ?? '');
          setDetails((prev) => ({ ...prev, ...(draft.details ?? {}) }));
          setDraftId(draft.draftId ?? '');
          setDraftSavedAt(draft.draftSavedAt ?? '');
          setUploadedFile(draft.uploadedFile ?? EMPTY_UPLOADED_FILE);
          setMessage('브라우저에 저장된 초안을 불러왔어.');
        } else {
          setMessage('이전 초안 불러오기를 건너뛰었어.');
        }
      }, 0);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const payload = {
        draftId,
        draftSavedAt,
        name,
        desc,
        details,
        uploadedFile,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draftId, draftSavedAt, name, desc, details, uploadedFile]);

  const changeDetail = (key) => (e) => {
    setDetails((prev) => ({ ...prev, [key]: e.target.value }));
  };

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage('');
    setFileLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const data = await apiUpload('/analysis/extract', form);
      setUploadedFile({
        fileName: data.fileName || file.name,
        fileType: data.fileType || file.type || '',
        extractedText: data.extractedText || '',
      });
      if (!name.trim() && data.suggestedProductName) setName(data.suggestedProductName);
      if (!desc.trim() && data.suggestedProductDescription) setDesc(data.suggestedProductDescription);
      setDetails((prev) => ({
        ...prev,
        material: prev.material || data.suggestedMaterial || '',
        intendedUse: prev.intendedUse || data.suggestedIntendedUse || '',
        specifications: prev.specifications || data.suggestedSpecifications || '',
        processingState: prev.processingState || data.suggestedProcessingState || '',
      }));
      setMessage(`파일 "${file.name}"에서 텍스트를 읽어왔어.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setFileLoading(false);
      e.target.value = '';
    }
  }

  async function saveDraft() {
    setError(null);
    setDraftLoading(true);
    try {
      const payload = {
        reportTitle: name || '초안',
        productName: name || '초안',
        productDescription: desc || '',
        ...details,
        specFileName: uploadedFile.fileName || null,
        specFileType: uploadedFile.fileType || null,
        specFileText: uploadedFile.extractedText || null,
      };
      const data = draftId
        ? await apiPatch(`/analysis/${draftId}/draft`, payload)
        : await apiPost('/analysis/draft', payload);
      setDraftId(data.id);
      setDraftSavedAt(data.createdAt || new Date().toISOString());
      sessionStorage.setItem(DRAFT_PROMPT_KEY, '1');
      setMessage('초안을 저장했어.');
    } catch (err) {
      setError(err.message);
    } finally {
      setDraftLoading(false);
    }
  }

  async function requestGuidedQuestion() {
    if (guidedLoading) return;
    setGuidedLoading(true);
    try {
      const data = await apiPost('/analysis/guided-hs', {
        productName: name,
        productDescription: desc,
        ...details,
        specFileText: uploadedFile.extractedText || '',
        conversation: guidedMessages.map(({ role, message }) => ({ role, message })),
      });
      const nextQuestion = data.nextQuestion || '계속 말해줘.';
      setGuidedMessages((prev) => {
        const last = prev.at(-1);
        if (last?.role === 'assistant' && last.message === nextQuestion) return prev;
        return [...prev, { role: 'assistant', message: nextQuestion }];
      });
      setGuidedReady(Boolean(data.ready));
      setGuidedCandidates(data.candidates || []);
      if (data.hints?.length) {
        const hintMessage = `힌트: ${data.hints.join(' / ')}`;
        setGuidedMessages((prev) => [
          ...(prev.at(-1)?.message === hintMessage ? prev : [...prev, { role: 'assistant', message: hintMessage }]),
        ]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGuidedLoading(false);
    }
  }

  async function submitStep1(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        productName: name,
        productDescription: desc,
        ...details,
        specFileName: uploadedFile.fileName || null,
        specFileType: uploadedFile.fileType || null,
        specFileText: uploadedFile.extractedText || null,
      };
      const guidance = await apiPost('/analysis/guided-hs', {
        ...payload,
        conversation: guidedMessages.map(({ role, message }) => ({ role, message })),
      });
      if (!guidance.ready) {
        setPreflightWarning({
          nextQuestion: guidance.nextQuestion,
          missingFields: guidance.missingFields || [],
          hints: guidance.hints || [],
        });
        setPendingAnalysisPayload(payload);
        setLoading(false);
        return;
      }

      const data = await apiPost('/analysis', payload);
      localStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(DRAFT_PROMPT_KEY);
      setReport(data);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function continueWithWarning() {
    if (!pendingAnalysisPayload) return;
    setPreflightWarning(null);
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost('/analysis', pendingAnalysisPayload);
      localStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(DRAFT_PROMPT_KEY);
      setReport(data);
      setStep(2);
      setPendingAnalysisPayload(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitStep2() {
    if (!selected) return;
    setError(null);
    setLoading(true);
    try {
      await apiPost(`/analysis/${report.id}/confirm`, { hsCode: selected });
      navigate(`/analysis/${report.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const confBar = (c) => c >= 0.7 ? 'bg-green' : c >= 0.5 ? 'bg-yellow' : 'bg-red';
  const confText = (c) => c >= 0.7 ? 'text-green' : c >= 0.5 ? 'text-yellow' : 'text-red';

  return (
    <div className="max-w-[920px] mx-auto">
      <div className="mb-6 bg-white rounded-xl soft-shadow p-5 border border-line">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-green text-[13px] font-semibold mb-2">AI 대화형 HS코드 판별</p>
            <h2 className="text-[24px] font-bold tracking-[-0.03em] text-text">부족한 정보를 물어보는 입력 보조</h2>
            <p className="text-[13px] text-text-sub mt-1">AI가 완제품/부품, 소재, 용도, 규격을 하나씩 확인하고 후보를 좁혀줘.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setGuidedMessages([{ role: 'assistant', message: '제품 정보를 적어주면 내가 부족한 걸 하나씩 물어볼게.' }]);
              setGuidedReady(false);
              setGuidedCandidates([]);
              setGuidedLoading(false);
            }}
            className="h-9 px-4 bg-white border border-line text-[12px] font-semibold text-text-sub"
          >
            대화 초기화
          </button>
        </div>

        <div className="mt-4 max-h-[260px] overflow-y-auto space-y-3 bg-bg-card border border-line p-4">
          {guidedMessages.map((item, index) => (
            <div key={`${item.role}-${index}`} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-3 text-[13px] leading-relaxed ${
                item.role === 'user' ? 'bg-[#173b5d] text-white' : 'bg-white border border-line text-text'
              }`}>
                {item.message}
              </div>
            </div>
          ))}
          {guidedLoading && <p className="text-[12px] text-text-faint">AI가 질문을 만들고 있어...</p>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={requestGuidedQuestion}
            disabled={guidedLoading}
            className="h-11 px-5 bg-text text-white text-[13px] font-bold disabled:opacity-40"
          >
            {guidedLoading ? '질문 생성 중...' : 'AI 다음 질문 받기'}
          </button>
          <button type="button" onClick={() => setDetails((prev) => ({ ...prev, processingState: '완제품' }))} className="h-11 px-4 bg-white border border-line text-[12px] font-semibold text-text-sub">완제품</button>
          <button type="button" onClick={() => setDetails((prev) => ({ ...prev, processingState: '부품' }))} className="h-11 px-4 bg-white border border-line text-[12px] font-semibold text-text-sub">부품</button>
          <button type="button" onClick={() => setDetails((prev) => ({ ...prev, material: prev.material || '금속 계열' }))} className="h-11 px-4 bg-white border border-line text-[12px] font-semibold text-text-sub">금속</button>
          <button type="button" onClick={() => setDetails((prev) => ({ ...prev, material: prev.material || '플라스틱 계열' }))} className="h-11 px-4 bg-white border border-line text-[12px] font-semibold text-text-sub">플라스틱</button>
        </div>

        {guidedReady && guidedCandidates.length > 0 && (
          <div className="mt-4 grid md:grid-cols-3 gap-3">
            {guidedCandidates.map((item) => (
              <div key={item.code} className="border border-green/20 bg-green/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-text">{item.code}</span>
                  <span className="text-[12px] font-bold text-green">{Math.round((item.confidence ?? 0) * 100)}%</span>
                </div>
                <p className="text-[13px] text-text-sub">{item.description}</p>
              </div>
            ))}
          </div>
        )}

        {guidedReady && (
          <p className="mt-3 text-[12px] text-text-faint">
            후보가 충분해졌어. 아래 입력 폼은 하나만 쓰면 돼. 필요하면 세부 정보만 수정한 뒤 HS코드 후보 조회를 눌러.
          </p>
        )}
      </div>

      {preflightWarning && (
        <div className="mb-6 bg-white border border-yellow/40 p-5 shadow-sm">
          <p className="text-[13px] font-bold text-yellow mb-2">입력 정보가 아직 부족해</p>
          <p className="text-[14px] text-text leading-relaxed">{preflightWarning.nextQuestion}</p>
          {preflightWarning.missingFields?.length > 0 && (
            <p className="mt-3 text-[12px] text-text-sub">
              부족한 항목: {preflightWarning.missingFields.join(', ')}
            </p>
          )}
          {preflightWarning.hints?.length > 0 && (
            <ul className="mt-3 space-y-1 text-[12px] text-text-sub list-disc pl-5">
              {preflightWarning.hints.map((hint, idx) => <li key={`${hint}-${idx}`}>{hint}</li>)}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setPreflightWarning(null)} className="h-10 px-4 border border-line bg-white text-[12px] font-semibold text-text-sub">
              다시 입력할게
            </button>
            <button type="button" onClick={continueWithWarning} className="h-10 px-4 bg-text text-white text-[12px] font-bold">
              그래도 분석하기
            </button>
          </div>
        </div>
      )}

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-4 text-[12px] uppercase tracking-[0.12em] mb-8">
        <span className={`flex items-center gap-2 font-bold ${step >= 1 ? 'text-green' : 'text-text-faint'}`}>
          <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ${
            step > 1 ? 'bg-green text-bg' : 'border border-green text-green'
          }`}>
            {step > 1 ? '✓' : '1'}
          </span>
          제품 정보
        </span>
        <span className={`w-10 border-t ${step > 1 ? 'border-green' : 'border-line'}`} />
        <span className={`flex items-center gap-2 font-bold ${step === 2 ? 'text-green' : 'text-text-faint'}`}>
          <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ${
            step === 2 ? 'border border-green text-green' : 'border border-line text-text-faint'
          }`}>
            2
          </span>
          HS코드 선택
        </span>
      </div>

      {/* Step 1: 제품 정보 입력 */}
      {step === 1 && (
        <>
      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
          <form onSubmit={submitStep1} className="bg-white rounded-xl p-6 md:p-9 soft-shadow">
            <p className="text-green text-[13px] font-semibold mb-2">1단계 · 제품 정보</p>
            <h1 className="text-[28px] font-bold tracking-[-0.03em] text-text mb-2">수출 제품 정보 입력</h1>
            <p className="text-text-sub text-[14px] mb-9">제품의 소재, 용도, 규격을 자세히 입력하면 분류 정확도를 높일 수 있습니다.</p>

            <div className="mb-8 border border-dashed border-line bg-bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[12px] font-bold text-text">제품 사양서 업로드</p>
                  <p className="text-[12px] text-text-faint">PDF, DOCX, TXT 파일을 올리면 내용을 읽어서 입력값을 채워줘.</p>
                </div>
                <label className="h-10 px-4 inline-flex items-center justify-center bg-text text-white text-[12px] font-bold cursor-pointer hover:bg-[#203454] transition-colors">
                  {fileLoading ? '읽는 중...' : '파일 선택'}
                  <input type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
              {uploadedFile.fileName && (
                <div className="mt-4 bg-white border border-line p-4">
                  <p className="text-[11px] text-text-faint mb-1">업로드된 파일</p>
                  <p className="text-[13px] font-semibold text-text break-all">{uploadedFile.fileName}</p>
                  {uploadedFile.extractedText && <p className="mt-2 text-[12px] text-text-sub leading-relaxed line-clamp-4">{uploadedFile.extractedText}</p>}
                </div>
              )}
            </div>

            <label className="block text-[11px] font-bold text-text-faint uppercase tracking-[0.15em] mb-2">
              제품명
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="예: 리튬이온 배터리 셀"
              className="w-full h-12 px-4 bg-bg border border-line text-[14px] text-text placeholder:text-text-faint focus:outline-none focus:border-green focus:ring-3 focus:ring-green/10 transition-all mb-8"
            />

            <label className="block text-[11px] font-bold text-text-faint uppercase tracking-[0.15em] mb-2">
              제품 설명
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              required
              rows={5}
              placeholder="용도, 소재, 규격, 특징 등을 상세히 입력해 주세요."
              className="w-full px-4 py-3 bg-bg border border-line text-[14px] text-text placeholder:text-text-faint focus:outline-none focus:border-green focus:ring-3 focus:ring-green/10 transition-all resize-none leading-relaxed mb-2"
            />
            <p className="text-[12px] text-text-faint mb-8">
              상세할수록 정확한 HS코드를 추정합니다.
            </p>

            <div className="border-t border-line pt-7 mb-8">
              <p className="text-[13px] font-bold text-text mb-1">분류 정확도를 높이는 추가 정보</p>
              <p className="text-[12px] text-text-faint mb-5">모르는 항목은 비워도 되지만, 소재·용도·사양이 중요해.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <DetailField label="주요 소재·구성 비율" value={details.material} onChange={changeDetail('material')} placeholder="예: 알루미늄 70%, 플라스틱 30%" />
                <DetailField label="사용 목적" value={details.intendedUse} onChange={changeDetail('intendedUse')} placeholder="예: 전기자전거 구동용" />
                <DetailField label="제품 사양" value={details.specifications} onChange={changeDetail('specifications')} placeholder="예: 48V, 20Ah, 4.2kg" />
                <DetailField label="가공·포장 상태" value={details.processingState} onChange={changeDetail('processingState')} placeholder="예: 조립 완료된 완제품" />
                <DetailField label="희망 수출국" value={details.targetCountries} onChange={changeDetail('targetCountries')} placeholder="예: 미국, 베트남" />
                <DetailField label="제품 사양서 URL" value={details.referenceUrl} onChange={changeDetail('referenceUrl')} placeholder="https://..." type="url" />
              </div>
            </div>

            {error && <p className="text-[13px] text-red font-serif italic mb-4">{error}</p>}
            {message && <p className="text-[12px] text-text-sub mb-4">{message}</p>}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={saveDraft}
                disabled={draftLoading}
                className="w-full sm:w-auto h-12 px-6 bg-white border border-line text-[13px] font-bold disabled:opacity-30 hover:border-green transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {draftLoading && <span className="w-3.5 h-3.5 border-2 border-text-faint border-t-green rounded-full animate-spin" />}
                {draftLoading ? '저장 중...' : '임시 저장'}
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim() || !desc.trim()}
                className="w-full h-12 px-6 bg-text text-white text-[13px] font-bold disabled:opacity-30 hover:bg-[#203454] transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading && <span className="w-3.5 h-3.5 border-2 border-text-faint border-t-text rounded-full animate-spin" />}
                {loading ? 'HS코드 조회 중...' : 'HS코드 후보 조회'}
              </button>
            </div>
          </form>
          <aside className="bg-[#173b5d] text-white rounded-xl p-6">
            <p className="text-white text-[13px] font-semibold pb-3 mb-4 border-b border-white/20">작성 안내</p>
            <ul className="space-y-5 text-[13px] text-white/65 leading-relaxed">
              <li><strong className="block text-white mb-1">01 · 제품 소재</strong>플라스틱, 철강, 리튬처럼 주된 소재를 적어줘.</li>
              <li><strong className="block text-white mb-1">02 · 사용 목적</strong>완제품인지 부품인지, 어디에 쓰는지 알려줘.</li>
              <li><strong className="block text-white mb-1">03 · 제품 규격</strong>용량, 크기, 가공 상태가 있으면 함께 적어줘.</li>
              <li><strong className="block text-white mb-1">04 · 파일 업로드</strong>사양서나 제안서를 올리면 텍스트를 읽어서 일부 필드를 채워줘.</li>
            </ul>
          </aside>
          </div>
        </>
      )}

      {/* Step 2: HS코드 선택 */}
      {step === 2 && report && (
        <>
          <div className="bg-white rounded-xl p-6 md:p-9 soft-shadow">
          <p className="text-green text-[13px] font-semibold mb-2">2단계 · 품목 분류</p>
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-text mb-2">HS코드 후보 선택</h1>
          <p className="font-serif italic text-text-sub text-[14px] mb-1">
            <span className="not-italic font-bold text-text">{report.productName || name}</span>의 HS코드 후보
          </p>
          <p className="font-serif italic text-[12px] text-text-faint mb-10">
            하나를 선택하면 3개 기관 데이터 분석이 시작됩니다.
          </p>

          <div className="space-y-3 mb-10">
            {(report.hsCodes || []).map((item) => {
              const active = selected === item.code;
              const pct = Math.round(item.confidence * 100);
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setSelected(item.code)}
                  className={`w-full text-left p-5 border rounded-lg transition-all cursor-pointer ${
                    active ? 'border-green bg-green/5' : 'border-line hover:border-text-faint bg-bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                        active ? 'border-green' : 'border-line'
                      }`}>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-green" />}
                      </span>
                      <span className="font-mono font-bold text-text text-[15px]">{item.code}</span>
                    </div>
                    <span className={`text-[12px] font-bold ${confText(item.confidence)}`}>{pct}%</span>
                  </div>
                  <p className="text-[13px] text-text-sub ml-[26px] mb-3">{item.description}</p>
                  <div className="ml-[26px] h-1 bg-line overflow-hidden">
                    <div className={`h-full transition-all ${confBar(item.confidence)}`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>

          {error && <p className="text-[13px] text-red font-serif italic mb-4">{error}</p>}

          <div className="flex items-center gap-4">
            <button
              onClick={() => { setStep(1); setReport(null); setSelected(''); setError(null); }}
              className="text-[13px] text-text-sub hover:text-text transition-colors cursor-pointer"
            >
              ← 이전
            </button>
            <button
              onClick={submitStep2}
              disabled={loading || !selected}
              className="h-11 px-6 bg-text text-white text-[13px] font-bold disabled:opacity-30 hover:bg-[#203454] transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-text-faint border-t-text rounded-full animate-spin" />}
              {loading ? '분석 중...' : '종합 분석 시작'}
            </button>
          </div>
          </div>
        </>
      )}
    </div>
  );
}

function DetailField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-text-faint mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full h-11 px-3 bg-bg border border-line text-[13px] text-text placeholder:text-text-faint focus:outline-none focus:border-green"
      />
    </div>
  );
}
