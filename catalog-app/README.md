# AE Catalogue — Public (Product + Finder)

Advanced Energy 임베디드 파워 카탈로그에서 **제품(카탈로그) 페이지**와 **파인더 페이지**만
추출한 공개용 Next.js 앱. 인증/메일/AI 등 백엔드 기능은 제거되어 정적 데이터만으로 동작한다.

## 실행
```bash
npm install
npm run dev      # http://localhost:4400
npm run build && npm start
```
핵심 의존성: `next`, `react`, `react-dom`, `fuse.js`, `tailwindcss` (package.json 참고).

## 라우트
- `/`        — 카탈로그(제품 검색/필터/카드)
- `/finder`  — 스펙 기반 제품 파인더
- `/api/ae-search`, `/api/ae-docs` — advancedenergy.com 에서 제품 페이지/데이터시트(PDF)
  링크를 실시간으로 가져오는 라우트(외부 fetch만). 상세 패널의 "AE 공식 문서"에 사용.

## 데이터 (public/data)
카드/상세에 필요한 **모든 제품 스펙 정보**가 여기에 있다.
- `catalog.json`     — 전 모델(1,500+): 카테고리·계보·시리즈·watts/volts/amps·input·specMap 등
- `seriesSpecs.json` — Semigate 제품 마스터에서 뽑은 시리즈별 입력전압/효율 보강값
- `webImages.json`   — 모델 → advancedenergy.com 공식 제품 이미지 URL (핫링크)
- `specs.json`       — 스펙 패싯 인덱스
- `ordering.json`    — 주문(파트넘버 구성) 테이블

데이터 결합/상속(변형 부품번호가 시리즈 공통 스펙을 상속, 웹이미지·시리즈스펙 병합)은
`src/lib/data.ts` 에서 처리한다.

## 자산 (public)
- `docs/AE Catalogue2026.pdf` — 카탈로그 원본 PDF. 상세 패널의 "Open PDF · p.N" 핫링크
  (`/docs/AE%20Catalogue2026.pdf#page=N`)가 이 파일을 페이지 단위로 연다.
- `images/`  — PDF 추출 로컬 제품 이미지(웹 이미지가 없는 모델의 폴백)
- `logo.png`, `semigate-logo.png`

## 주요 소스
- `src/app/page.tsx`        — 카탈로그 페이지
- `src/app/finder/page.tsx` — 파인더
- `src/components/`         — FilterRail, ResultList, DetailDrawer, OrderingConfigurator,
  BasketFab(저장목록), GlobalNav
- `src/lib/`               — data, types, basket, docAttachments, usePersistentState
