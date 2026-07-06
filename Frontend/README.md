# ExportNavi Frontend

중소 수출기업을 위한 수출 사전검토 서비스의 React 프론트엔드다.

## 실행

```bash
npm install
npm run dev
```

개발 서버는 `http://localhost:5173`에서 실행되며 `/api`, `/oauth2`, `/login/oauth2` 요청은 `http://localhost:8082` 백엔드로 전달된다.

## 검증

```bash
npm run lint
npm run build
```

## 주요 화면

- `/login`: Google 로그인
- `/`: 분석 리포트 검색·목록
- `/analysis/new`: 제품 상세 입력과 HS코드 추정
- `/analysis/:id`: 국가 비교, 데이터 출처 상태, 실행 체크리스트, 공유·재분석·PDF 인쇄
- `/profile`: 회사 기본정보 관리
- `/shared/:token`: 인증 없이 보는 읽기 전용 공유 리포트

실제 데이터와 데모 데이터는 결과 화면의 `LIVE/DEMO/FAILED` 상태로 구분한다.
