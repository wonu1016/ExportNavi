import { Link } from 'react-router-dom';

const features = [
  ['01', 'HS코드 후보 판별', '제품명, 소재, 용도, 규격을 바탕으로 HS코드 후보를 먼저 좁혀줍니다.'],
  ['02', '국가별 수출 가능성 비교', '시장성, 관세, 국가 위험을 한 화면에서 비교할 수 있게 정리합니다.'],
  ['03', '전략물자·출처 상태 확인', 'YesTrade, KOTRA, KSURE 등 조회 상태를 함께 보여줘 판단 근거를 남깁니다.'],
  ['04', '리포트 저장과 공유', '완료된 분석은 다시 열람하고 읽기 전용 링크로 공유할 수 있습니다.'],
];

const cards = [
  {
    tag: '시작',
    title: '새 제품 분석',
    text: '제품 정보를 입력하고 HS코드 후보부터 수출 가능성까지 이어서 확인합니다.',
    to: '/analysis/new',
    tone: 'border-cyan/40',
  },
  {
    tag: '검토',
    title: '처리 필요 항목',
    text: 'HS코드 선택, 실패한 분석, 출처 확인이 필요한 리포트를 따로 봅니다.',
    to: '/dashboard/action',
    tone: 'border-orange/40',
  },
  {
    tag: '관리',
    title: '완료 리포트',
    text: '완료된 수출 분석 결과를 다시 열람하고 비교·공유합니다.',
    to: '/dashboard/completed',
    tone: 'border-green/40',
  },
];

export default function DashboardHome() {
  return (
    <div className="space-y-20">
      <section className="min-h-[620px] grid lg:grid-cols-[1fr_460px] gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 h-9 px-4 border border-cyan/40 bg-cyan/5 text-cyan rounded-lg text-[13px] font-bold mb-8">
            <span className="w-2 h-2 rounded-full bg-cyan" />
            중소 수출기업 의사결정 지원
          </div>

          <h1 className="text-[46px] md:text-[64px] font-black tracking-[-0.05em] leading-[1.08] text-text mb-8">
            수출 전에 필요한 검토,<br />
            <span className="text-[#173b5d]">데이터로 먼저 확인하세요</span>
          </h1>

          <p className="text-[17px] leading-[1.9] text-text-sub max-w-[620px] mb-10">
            제품 정보만 입력하면 HS코드 후보, 추천 시장, 국가 위험, 전략물자 검토를
            순서대로 정리합니다. 복잡한 자료는 리포트로 남기고 필요한 화면에서만 확인하세요.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link to="/analysis/new" className="h-14 px-8 bg-[#173b5d] text-white rounded-xl text-[15px] font-bold inline-flex items-center justify-center hover:bg-[#102c46] transition">
              새 분석 시작
            </Link>
            <Link to="/dashboard/action" className="h-14 px-7 bg-white border border-line text-text-sub rounded-xl text-[15px] font-bold inline-flex items-center justify-center hover:border-cyan hover:text-text transition">
              처리할 항목 보기
            </Link>
          </div>
        </div>

        <div className="bg-white border border-line rounded-[24px] overflow-hidden shadow-[0_24px_80px_rgba(23,59,93,0.10)]">
          <div className="px-7 py-6 border-b border-line">
            <p className="text-[15px] font-bold text-text-sub">서비스 주요 기능</p>
          </div>
          <div>
            {features.map(([num, title, text]) => (
              <div key={num} className="grid grid-cols-[48px_1fr] gap-4 px-7 py-6 border-b border-line last:border-b-0">
                <span className="w-10 h-10 rounded-lg bg-cyan/10 text-cyan text-[16px] font-black flex items-center justify-center">
                  {num}
                </span>
                <div>
                  <p className="text-[16px] font-bold text-text mb-2">{title}</p>
                  <p className="text-[14px] leading-[1.7] text-text-sub">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-7 py-5 bg-[#edf7f8] text-cyan text-[14px] font-bold">
            모든 결과는 참고용이며 최종 판단 전 공식 출처 확인이 필요합니다.
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(110deg,#f4fbfb_0%,#ffffff_55%,#f7f5ef_100%)] border border-line rounded-[24px] px-6 md:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-cyan text-[13px] font-bold mb-3">업무 바로가기</p>
            <h2 className="text-[34px] font-black tracking-[-0.04em] text-text">필요한 화면으로 바로 이동</h2>
            <p className="text-[15px] text-text-sub mt-3">메인 화면에는 기능을 쌓지 않고, 각 작업 화면을 분리해서 사용합니다.</p>
          </div>
          <Link to="/dashboard/progress" className="h-12 px-6 bg-white border border-cyan/30 text-cyan rounded-xl text-[14px] font-bold inline-flex items-center justify-center hover:bg-cyan/5">
            진행 중 보기
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {cards.map((card) => (
            <Link key={card.title} to={card.to} className={`bg-white border ${card.tone} rounded-[18px] p-6 min-h-[210px] hover:translate-y-[-2px] hover:shadow-[0_18px_50px_rgba(23,59,93,0.10)] transition`}>
              <div className="flex items-center justify-between mb-8">
                <span className="h-8 px-3 rounded-full bg-bg text-[12px] font-bold text-text-sub inline-flex items-center">{card.tag}</span>
                <span className="text-[13px] font-bold text-cyan">열기</span>
              </div>
              <h3 className="text-[21px] font-black tracking-[-0.03em] text-text mb-4">{card.title}</h3>
              <p className="text-[14px] leading-[1.8] text-text-sub">{card.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-5">
        {[
          ['분류', 'HS코드 후보를 먼저 확인하고 확정 후 분석을 이어갑니다.'],
          ['비교', '추천 국가와 위험도를 나란히 보고 우선순위를 정합니다.'],
          ['실행', '체크리스트와 공유 링크로 후속 업무를 관리합니다.'],
        ].map(([title, text]) => (
          <div key={title} className="bg-white border border-line rounded-[18px] p-7">
            <div className="w-12 h-12 rounded-xl bg-[#173b5d] text-white flex items-center justify-center text-[18px] font-black mb-8">
              {title.slice(0, 1)}
            </div>
            <h3 className="text-[20px] font-black tracking-[-0.03em] text-text mb-4">{title}</h3>
            <p className="text-[14px] leading-[1.9] text-text-sub">{text}</p>
          </div>
        ))}
      </section>

      <section className="bg-[#173b5d] text-white rounded-[24px] px-7 md:px-10 py-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <p className="text-white/60 text-[13px] font-bold mb-3">지금 바로 시작하세요</p>
          <h2 className="text-[30px] font-black tracking-[-0.04em] leading-[1.25]">
            새 제품 정보를 입력하고<br />수출 가능성을 먼저 확인하세요
          </h2>
        </div>
        <Link to="/analysis/new" className="h-14 px-8 bg-white text-[#173b5d] rounded-xl text-[15px] font-black inline-flex items-center justify-center hover:bg-bg">
          제품 분석하기
        </Link>
      </section>
    </div>
  );
}
