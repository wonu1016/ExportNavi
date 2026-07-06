# CLAUDE.md

이 파일은 향후 Claude 세션이 이 프로젝트의 맥락을 빠르게 이해하도록 돕는 문서입니다.

## 프로젝트 개요

**수출 코파일럿 (ExportCopilot)** — 제14회 산업통상부 공공데이터 활용 아이디어 공모전 출품작 프로토타입.

중소 수출기업의 3대 페인을 제품 정보 하나로 한 번에 진단하는 AI 웹 서비스:
1. **어디에 팔지** — 유망 수출시장 추천
2. **대금 떼일 위험** — 국가·바이어 리스크 진단
3. **수출하면 안 되는 품목인지** — 전략물자 수출통제 체크

LLM이 제품 설명 → HS코드 추정 → 3개 기관 데이터 조회 → 종합 액션 리포트를 생성하는 흐름.

## 최근 반영 내용

최근 작업 기준으로는 "제품 하나 넣으면 분석 흐름이 끝까지 이어지는 구조"를 많이 보강했다.

- 제품명/설명 입력 후 HS코드 후보를 추정하고, 후보 선택 후 종합 분석으로 이어지는 흐름을 정리했다.
- 분석 결과 화면에 유망 수출국, 국가 위험, 전략물자 가능성, 면책 문구, 데이터 출처를 함께 보여주도록 구성했다.
- 제품 사양서 URL 입력뿐 아니라 업로드 기반 분석 흐름도 들어갔다.
- 분석 결과를 저장, 재분석, 공유, 삭제할 수 있게 만들었다.
- 임시 저장 / 체크리스트 / 결과 상세 보기처럼 사용자가 중간에 멈췄다가 다시 이어갈 수 있는 기능을 넣었다.
- 로그인은 Google OAuth + JWT 흐름으로 동작하고, 성공 후 프론트로 돌아오는 구조를 정리했다.
- 현재 로컬 개발 포트는 백엔드 8082, 프론트엔드 5175로 맞춰져 있다.
- 백엔드 실행용으로 루트에 `start-backend` 스크립트를 추가했다.

## 공모전 컨텍스트

- 주제: 공공데이터 + AI·LLM으로 지역 활력 / 기업 성장 (본 작품은 **기업 성장** 트랙)
- 활용 데이터 (산업통상부 산하기관): **KOTRA**(유망시장·바이어), **한국무역보험공사**(국가신용·수출보험), **무역안보관리원/yesTrade**(전략물자 HSK 연계표)
- 일정: 접수 ~2026.07.06 / 1차 서류 07.07~10 / 2차 발표평가 07.27~31 / 시상 08
- 발표평가 배점: 구체성·구현(30, 프로토타입 시연 중요), 사업화 가능성(30), 문제해결(25, 정량효과), 창의성(15), AI 활용 확산성 가산점(5, API·에이전트 연계)

## 백엔드 기술 스택

- **Spring Boot 4.1.0** / Java 21 / Gradle
- **의존성**: starter-web, starter-data-jpa, starter-webflux(WebClient), starter-validation, starter-oauth2-client, starter-security, Lombok, H2, MySQL, JJWT
- **DB**: Docker Compose로 MySQL 8.0 관리 (`docker-compose.yml`)
- **인증**: Google OAuth 2.0 로그인 + JWT (구현 완료)
- **Jackson 3.x 주의**: Spring Boot 4.1.0은 Jackson 3.x 사용. 패키지가 `com.fasterxml.jackson` → `tools.jackson`으로 변경됨. `JsonProcessingException` → `JacksonException`.

## 백엔드 패키지 구조 (`com.asdf.exportnavi`)

```
entity/          — JPA 엔티티 (Member, AnalysisReport, HsCode, MarketRecommendation, RiskAssessment, StrategicItem)
repository/      — JPA Repository (6개, 엔티티별 1:1)
service/         — 비즈니스 로직 (AnalysisService, MemberService, KotraService, KsureService, YesTradeService)
controller/      — REST API 컨트롤러 (AnalysisController, MemberController)
dto/             — 요청/응답 DTO (AnalysisRequestDto, AnalysisResponseDto, HsCodeConfirmRequestDto 등 7개)
config/          — Spring 설정 (CorsConfig, WebClientConfig, SecurityConfig, GlobalExceptionHandler)
ai/              — LLM API 호출 (ClaudeService — HS코드 추정 + 종합 리포트 생성)
security/        — 인증 (JwtTokenProvider, JwtAuthenticationFilter, OAuth2SuccessHandler)
```

## API 엔드포인트

```
POST /api/analysis              — 1단계: 제품 정보 입력 → AI가 HS코드 후보 추정
POST /api/analysis/{id}/confirm — 2단계: HS코드 확정 → 유망시장+리스크+전략물자 분석 → 종합 리포트
GET  /api/analysis/{id}         — 리포트 단건 조회
GET  /api/analysis              — 내 리포트 목록 조회
GET  /api/me                    — 로그인된 사용자 정보

GET  /oauth2/authorization/google — 구글 로그인 시작 (→ 구글 리다이렉트)
     → 성공 시 {frontend}/oauth/callback 로 리다이렉트
```

- 모든 `/api/**`는 JWT 인증 필수 (`Authorization: Bearer {token}`)
- 미인증 시 401 `{"error":"로그인이 필요합니다"}` 반환

## 분석 플로우

```
1. POST /api/analysis (productName, productDescription)
   → ClaudeService.estimateHsCodes() → HS코드 후보 3개
   → status: PENDING → HS_CODE_ESTIMATED

2. POST /api/analysis/{id}/confirm (hsCode)
   → KotraService.getPromisingMarkets()      — 유망시장 4개국
   → KsureService.getCountryRisk()           — 국가별 리스크
   → YesTradeService.checkStrategicItem()    — 전략물자 판정
   → ClaudeService.generateReport()          — 종합 리포트 (교차 해석)
   → status: HS_CODE_CONFIRMED → ANALYZING → COMPLETED
```

## 인증 흐름 (Google OAuth + JWT)

```
프론트엔드 → /oauth2/authorization/google → 구글 로그인
→ OAuth2SuccessHandler: Member 저장 + JWT 발급 + 쿠키 저장
→ {frontend}/oauth/callback 으로 리다이렉트
→ 이후 API 호출 시 Authorization: Bearer {token} 헤더 포함
```

- `JwtTokenProvider`: JWT 생성/검증/이메일추출
- `JwtAuthenticationFilter`: 매 요청 Bearer 토큰 검사 → SecurityContext에 인증 세팅
- `OAuth2SuccessHandler`: 구글 로그인 성공 → Member 생성/업데이트 → JWT 발급 → 프론트 리다이렉트

## 엔티티 관계도

```
Member (회원 - Google OAuth)
  │
  └─── 1:N ─── AnalysisReport (분석 리포트)
                  │
                  ├── 1:N ─── HsCode (HS코드 후보, confidence, confirmed)
                  ├── 1:N ─── MarketRecommendation (유망시장, score, tariffRate, ftaApplied)
                  ├── 1:N ─── RiskAssessment (국가 리스크, riskGrade, creditRating)
                  └── 1:1 ─── StrategicItem (전략물자, isStrategic, category)
```

- `AnalysisReport.status`: PENDING → HS_CODE_ESTIMATED → HS_CODE_CONFIRMED → ANALYZING → COMPLETED
- `AnalysisReport.overallGrade`: A / B / C / D (종합 수출 적합도)

## 안전 설계 (구현 완료)

- **응답에 면책 문구(`disclaimer`)** 상시 포함 — "참고용 안내이며 법적 효력 없음, yesTrade 공식 자가판정 필수"
- **출처 표기(`dataSources`)** — 단계별 사용 데이터 출처 명시 (KOTRA, 무역보험공사, yesTrade, Claude AI)
- **AI 프롬프트에 안전 원칙 내장** — "안내 vs 판정" 구분, 교차 해석, 데이터 지어내지 않기, 모르면 모른다
- **전략물자**: 절대 "수출 가능" 단정 금지 → "통제 가능성 있음 → yesTrade 공식 자가판정 필수"로 안내

## 외부 API 목업 폴백

모든 외부 서비스(Claude, KOTRA, K-SURE, yesTrade)는 **API 키 미설정 시 현실적인 목업 데이터 반환**:
- `ClaudeService`: API 키 없으면 목업 HS코드 3개 + 목업 리포트
- `KotraService`: 베트남/미국/인도네시아/독일 4개국 목업
- `KsureService`: 국가코드별 리스크 등급 목업 (VN=BB, US=AAA 등)
- `YesTradeService`: 비해당 목업 + 면책 문구

## Docker 구성

- `docker-compose.yml`에 MySQL 8.0 컨테이너 정의
- DB명: `exportnavi` / 계정: `exportnavi` / 비번: `exportnavi1234`
- 호스트 포트: **3308** → 컨테이너 3306 (다른 프로젝트와 포트 충돌 방지)
- `application.properties`에서 `localhost:3308` 연결
- `docker compose up -d`로 실행, Spring Boot는 로컬에서 별도 실행

## 환경변수 / 실행 방법

```bash
# 1. MySQL 시작
cd Backend
docker compose up -d

# 2. 백엔드 실행 (환경변수 로드 + Spring Boot)
source .env && ./gradlew bootRun
# → http://localhost:8082

# 또는 루트에서
./start-backend

# 3. 프론트엔드 실행 (별도 터미널)
cd Frontend
npm install   # 최초 1회
npm run dev
# → http://localhost:5175
```

`.env` 파일 (git 제외됨, Backend 폴더에 위치):
```
export GOOGLE_CLIENT_SECRET=...
```

`application.properties`에서 환경변수 참조:
- `${GOOGLE_CLIENT_SECRET}` — 구글 OAuth 클라이언트 시크릿
- `${JWT_SECRET:...}` — JWT 서명 키 (기본값 포함)
- `${CLAUDE_API_KEY:}` — Claude API 키 (없으면 목업)
- `${KOTRA_API_KEY:}`, `${KSURE_API_KEY:}`, `${YESTRADE_API_KEY:}` — 공공데이터 API 키 (없으면 목업)

Google Cloud Console 설정 (OAuth):
- 승인된 리디렉션 URI: `http://localhost:8082/login/oauth2/code/google`
- 테스트 사용자 등록 필요 (앱 게시 전까지)

## 프론트엔드 기술 스택

- **React 19** + **Vite 6** + **Tailwind CSS 4** (`@tailwindcss/vite` 플러그인)
- **react-router-dom v7** — 클라이언트 사이드 라우팅
- **디자인**: AI 느낌 없는 깔끔한 전문가용 UI, 한국어 인터페이스

## 프론트엔드 구조 (`Frontend/src/`)

```
main.jsx              — 앱 진입점
App.jsx               — BrowserRouter + Routes 정의
api/client.js         — fetch 래퍼 (JWT 자동 첨부, 401 시 로그인 리다이렉트)
hooks/useAuth.js      — 인증 상태 훅 (GET /api/me 호출)
components/
  Header.jsx          — 상단 고정 헤더 (로고 + 사용자 정보)
  Layout.jsx          — 인증 체크 래퍼 (미인증 시 /login 리다이렉트)
pages/
  LoginPage.jsx       — Google 로그인 버튼 (깔끔한 중앙 카드)
  OAuthCallback.jsx   — JWT 토큰 수신 → localStorage 저장 → / 리다이렉트
  AnalysisList.jsx    — 대시보드 (리포트 목록 카드)
  AnalysisNew.jsx     — 2단계 폼: 제품 입력 → HS코드 선택 → 분석
  AnalysisResult.jsx  — 종합 리포트 (유망시장/리스크/전략물자/AI 해설)
```

## 프론트엔드 라우트

```
/login              — 로그인 페이지
/oauth/callback     — OAuth 콜백 (JWT 수신)
/                   — 대시보드 (리포트 목록) [인증 필요]
/analysis/new       — 새 분석 시작 [인증 필요]
/analysis/:id       — 분석 결과 조회 [인증 필요]
```

## Vite 프록시 설정

```
/api/*           → http://localhost:8082  (백엔드 REST API)
/oauth2/*        → http://localhost:8082  (Google OAuth 시작)
/login/oauth2/*  → http://localhost:8082  (OAuth 콜백 처리)
```

- 주의: `/login`은 프록시하지 않음 (프론트엔드 React 라우트와 충돌)

## 포트 구성

| 서비스 | 포트 |
|--------|------|
| 프론트엔드 (Vite) | 5175 |
| 백엔드 (Spring Boot) | 8082 |
| MySQL (Docker) | 3308 → 3306 |

- 포트를 기본값(3000, 8080, 3306)에서 변경한 이유: 다른 프로젝트 컨테이너와 충돌 방지

## 개발 로드맵

- [x] Phase 1: 패키지 구조 + Entity 설계
- [x] Phase 2: Repository 생성 (6개)
- [x] Phase 3: AI 연동 (ClaudeService — HS코드 추정 + 종합 리포트, 목업 폴백)
- [x] Phase 4: 공공데이터 API 연동 (KotraService, KsureService, YesTradeService — 목업 폴백)
- [x] Phase 5: REST API (Controller + DTO + Service + GlobalExceptionHandler + 안전설계)
- [x] Phase 6: Google OAuth 2.0 로그인 + JWT 인증 (SecurityConfig, JwtTokenProvider, OAuth2SuccessHandler)
- [x] Phase 7: 프론트엔드 개발 (React + Vite + Tailwind CSS)
- [ ] Phase 8: 실제 공공데이터 API 키 연동 (KOTRA, K-SURE, yesTrade)
- [ ] Phase 9: Claude API 키 연동 (실제 LLM 호출)
- [ ] Phase 10: 발표 시연 안정화 (API 응답 캐싱, 에러 핸들링 보강)

## 다음 단계 상세

### Phase 8: 실제 공공데이터 API 연동
- data.go.kr에서 API 키 발급 (KOTRA, 무역보험공사, yesTrade)
- `.env`에 키 추가, 서비스 클래스의 실제 API 엔드포인트/파싱 로직 검증
- 응답 구조가 목업과 다를 수 있으므로 파싱 로직 수정 필요

### Phase 9: Claude API 연동
- `.env`에 `CLAUDE_API_KEY` 추가
- HS코드 추정/리포트 생성 실제 테스트
- 프롬프트 튜닝 (실제 데이터 기반)

### Phase 10: 발표 시연 안정화
- 공공데이터 API 응답 DB 캐싱 — 시연 중 외부 API 장애 대비
- 에러 시 사용자 친화적 메시지
- 시연용 데모 데이터 사전 준비

## 차별화 / 포지셔닝 (트라이빅 대응)

- **정면승부 금지**: 시장 추천만 보면 KOTRA 트라이빅(1.5억 건, 128개 무역관)·KITA AI빅데이터를 못 이긴다. 시장 추천으로 경쟁하면 진다.
- **무게중심 = 리스크·컴플라이언스**: 트라이빅이 안 다루는 ②대금 떼일 위험(무역보험공사) + ③전략물자 통제(yesTrade)를 핵심으로. 이건 시장 발굴이 아니라 다른 결의 문제.
- **트라이빅은 경쟁자 아닌 데이터 소스**: 시장 추천은 트라이빅/KOTRA Open API를 끌어다 쓰고, 우리는 그 위에서 "수출해도 되는가"의 **종합 판단 층**을 얹는다.
- **차별점 = 통합 + 교차 해석**: 단순 링크 모음이 아니라, LLM이 3개 기관 데이터를 교차 해석해 하나의 의사결정 리포트로 (예: "베트남 유망하나 바이어 국가신용 낮음 → 신용장 권장 / 단 전략물자 의심 → yesTrade 판정 먼저").
- **타깃 = HS코드도 모르는 초보 수출기업**: 제품 설명 한 줄만으로. (트라이빅은 무역지식 전제)
- 발표 대응 한 줄: "트라이빅과 경쟁이 아니라, 흩어진 공공데이터를 LLM이 교차 해석해 초보자도 한 화면에서 최종 판단을 받게 하는 층."

## 보강 필요 (공모전 평가 대비)

- **문제 정의 정량화**: 타깃 좁히기(예: 수출 경험 3년 미만 초보기업 N개사) + 무역사고율·전략물자 무허가 적발 건수·HS 오분류 과태료 등 공신력 출처 수치 1~2개.
- **정량 기대효과**(배점 큰 항목): 시간 절감(3개 사이트 30분 → 1화면 1분), 무역사고·과태료 회피 기대액, 활용 데이터셋/API 항목 수 — "추정치 + 산출근거" 함께.

## 해결된 이슈 (개발 중 만났던 문제들)

- **Jackson 3.x 패키지 변경**: Spring Boot 4.1.0은 Jackson 3.x 사용 → `com.fasterxml.jackson` → `tools.jackson`, `JsonProcessingException` → `JacksonException`
- **readOnly 트랜잭션에서 쓰기**: 클래스 레벨 `@Transactional(readOnly=true)`가 Member 생성 메서드까지 적용 → 메서드 레벨 `@Transactional` 오버라이드로 해결
- **strategicItem null**: OneToOne 역방향 미설정 → `report.setStrategicItem(item)` 추가
- **API 302 응답**: Spring Security OAuth2 기본 동작이 미인증 시 리다이렉트 → 커스텀 `authenticationEntryPoint`에서 401 JSON 반환
- **Google OAuth client-id 오타**: `210800490282-...` → `10800490282-...` (앞자리 `2` 제거)
- **포트 충돌**: 다른 프로젝트(gao)가 8080, 3306 사용 → ExportNavi를 8081, 3308로 변경
- **Whitelabel 에러**: Vite 프록시 `/login`이 프론트엔드 React 라우트를 가로챔 → `/login/oauth2`로 변경

## 알려진 리스크 / 주의

- 무역보험공사 **개별 바이어 신용은 비공개** 가능성 → "국가·산업 단위 리스크"로 범위 조정함
- 전략물자 판정은 법적 책임 영역 → **참고용, 최종은 yesTrade 공식 자가판정** 면책 필수
- 기존 서비스(KOTRA 트라이빅, yesTrade)와 차별점 = "흩어진 3개 기관을 한 화면 통합 + LLM 교차 해석·자연어 해설" (상세는 위 '차별화/포지셔닝' 참고)
- Google OAuth **테스트 모드**: 현재 등록한 테스트 사용자만 로그인 가능. 발표 전에 "앱 게시"로 전환 필요.

## 작업 규칙

- 답변은 한국어
- 코드 전체를 한 번에 주지 말고 구조 중심으로 설명
- 작업 전 outputs 폴더 상태를 먼저 확인
