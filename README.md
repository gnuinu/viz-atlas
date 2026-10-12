# Viz Atlas

고객에게 설명하고, 직접 실험하고, 다시 참고할 수 있는 React 데이터 시각화 예제 모음입니다.

**[데모 열기 →](https://gnuinu.github.io/viz-atlas/)**

첫 컬렉션 **Prediction Lab**에서는 가상의 반도체 박막 두께 예측을 통해 실제값과 예측값의 관계를 탐색합니다. 모든 데이터와 모델 예측은 교육용 합성 데이터입니다.

## 포함된 기능

- 6개 시나리오: 균형, 일정한 과대예측, 이분산, 특정 설비 오류, 시간 변화, 과신
- 모델 A/B 비교, 설비·실제값 구간 필터, 허용 오차 슬라이더
- Parity Plot, 잔차 플롯, 그룹별 박스 플롯, 절대오차 ECDF
- 예측 구간, 설비별 실제 포함률, 일별 예측·오차 추이
- 조건별 오차 히트맵: 설비 × 실제값 구간의 MAE·평균 잔차·허용 오차 충족률
- 동일 샘플의 모델 개선도: 개선·악화·동일 비율과 양쪽 끝 표본 비교
- 50·70·80·90·95% 목표별 전체·설비별 보정 곡선과 구간 폭
- 연결된 샘플 선택, 키보드로 조작하는 샘플 목록
- 설정을 보존하는 공유 URL, 필터된 데이터 CSV 내보내기
- 시각화 라이브러리, 한국어 해석 가이드 및 참고 자료
- 모바일 화면, 인쇄 스타일, 동작 감소 설정 지원

## 새 진단 사용하기

1. **조건별 비교** 탭에서 히트맵의 셀을 선택합니다. 설비·실제값 구간이 다른 차트, 지표, CSV에도 적용됩니다. 같은 셀을 다시 누르면 전체로 돌아갑니다.
2. 아래 산점도에서 `|오차 A| − |오차 B|`를 확인합니다. 양수는 B가 개선한 표본, 음수는 악화한 표본입니다. 평균 개선도는 MAE A − MAE B와 같습니다.
3. **불확실성** 탭 아래의 보정 곡선에서 목표 포함률과 관측된 포함률을 비교합니다. 선택한 설비를 강조하면서 다른 설비도 함께 보여 줍니다. 구간 폭 표로 과도하게 넓은 구간인지 확인합니다.

히트맵은 선택 후에도 전체 조건 지도를 유지하고 A/B 공통 색 범위를 사용합니다. 보정 곡선 역시 설비 전체를 비교하며, 실제값 구간 필터만 평가 표본을 좁힙니다. 표본이 15개 미만인 셀의 † 표시는 데모용 주의 표시이며 통계적 유의성 기준이 아닙니다. 실제값 구간은 관측 이후의 진단에 사용하며 운영 시 모델 선택 규칙으로 바로 사용할 수 없습니다.

## 디자인

토스의 [컬러 시스템 설계](https://toss.tech/article/43385)와 [타이포그래피](https://tossmini-docs.toss.im/tds-mobile/foundation/typography/)를 참고한 독립 테마입니다. 파란색 강조, 밝은 회색 배경, 넓은 여백과 둥근 카드로 시각적 위계를 구성했습니다. 글꼴은 공개 라이선스의 [Pretendard](https://github.com/orioncactus/pretendard)를 사용하며, 로고는 Viz Atlas 자체 SVG입니다.

`src/styles.css`의 의미별 CSS 변수로 버튼·선택 상태·차트 색상을 관리합니다. 정확도 산점도는 파랑으로 허용 범위 이내, 빨강으로 범위 초과를 나타냅니다. 모델과 설비를 구분하는 차트에는 범례·선 모양·수치를 함께 제공합니다.

## 로컬 실행

Node.js 24 LTS 권장 (최소 22.12).

```bash
nvm install
nvm use
npm ci
npm run dev
```

개발 주소: http://127.0.0.1:5173/viz-atlas/

```bash
npm run check       # 통계·데이터 테스트와 TypeScript/프로덕션 빌드
npx playwright install chromium
npm run test:e2e    # 실제 브라우저 상호작용과 모바일 검증
npm run preview    # 프로덕션 빌드 미리보기
```

Chrome이 설치된 로컬 환경에서는 `PW_CHROME=1 npm run test:e2e`로 설치된 Chrome을 사용할 수 있습니다.

## 기술 구성

React 19 · TypeScript · Vite 8 · D3 scales/shapes · Lucide · Vitest · Playwright.

백엔드 없이 브라우저에서 데이터를 생성하고 평가합니다. Pretendard Variable 웹 폰트를 jsDelivr에서 불러오며 실패하면 시스템 폰트를 사용합니다. CSV 업로드나 외부 데이터 저장 기능은 없습니다.

```text
src/
  App.tsx          # 앱, 탐색 설정, 라이브러리와 가이드
  Charts.tsx       # 반응형 SVG 차트와 연결된 선택
  ChartCard.tsx    # 공통 차트 카드
  AdvancedDiagnostics.tsx # 히트맵, 모델 개선도, 보정 곡선
  diagnostics.ts   # 조건별 필터, 표본 매칭, 목표별 포함률
  diagnostics.test.ts # 구간 경계, 동일 표본 비교, 평가 데이터 분리 검증
  data.ts          # 합성 데이터, 통계, 예측 구간, URL/CSV
  data.test.ts     # 통계·시나리오 검증
  styles.css       # 반응형 스타일
tests/app.spec.ts  # 브라우저 동작 테스트
```

## 데이터와 해석

- 평가: 설비 3대 × 120개 = 360개 표본. 2026년 9월 30일, 일별 12개.
- 단위: nm. 잔차는 **실제 − 예측**으로 통일합니다.
- 같은 샘플의 실제값과 잡음 시드를 유지해 시나리오/모델을 비교합니다.
- 240개 독립 보정 표본으로 split-conformal 방식의 대칭 90% 예측 구간을 계산합니다. 보정은 모든 설비를 사용하며 필터는 평가 대상만 바꿉니다.
- 보정 곡선은 같은 별도 보정 표본의 유한 표본 보정 분위수로 목표별 폭을 계산합니다. 설비·실제값 구간별로 재보정하지 않습니다. 집단별 포함률 보장은 없으며 유한 평가 표본의 변동도 고려해야 합니다.
- 과신 시나리오는 모델 A의 구간 반폭을 35%로 축소합니다. 모델 B와 점 예측은 동일합니다.
- 시간 변화 시나리오는 보정 이후 평가 후반에 편향을 넣습니다. 이때 교환가능성 가정이 깨질 수 있어 90% 포함을 보장하지 않습니다.
- 박스 수염은 Q1/Q3에서 1.5 IQR 이내 실제 관측값까지이며, 모든 점을 함께 표시합니다.
- 예측 구간 차트에는 예측값으로 정렬한 평가 샘플에서 고르게 뽑은 최대 36개만 표시하지만 지표는 필터된 전체 표본으로 계산합니다.

실제 학습 모델, 진짜 제조 데이터, 미래 시계열 예측의 rolling-origin 검증은 포함하지 않습니다. 시나리오 B의 ‘개선’ 표시는 시뮬레이션 설계이며 실증 성능 주장이 아닙니다.

## GitHub Pages

Vite의 `base`는 `/viz-atlas/`입니다. 해시 탐색과 쿼리 설정을 사용하므로 공유 링크를 새로고침해도 Pages에서 작동합니다.

`.github/workflows/deploy.yml`은 `main` push 시 테스트 → 빌드 → 브라우저 테스트 → Pages 배포를 실행합니다. Pull request에서는 검증만 수행합니다. 저장소 **Settings → Pages → Source: GitHub Actions** 설정이 필요합니다.

## 참고 자료

- [scikit-learn: PredictionErrorDisplay](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.PredictionErrorDisplay.html)
- [Evidently: Regression evaluation](https://docs.evidentlyai.com/metrics/preset_regression)
- [MAPIE: Conformal prediction](https://mapie.readthedocs.io/en/stable/)
- [Forecasting: Principles and Practice](https://otexts.com/fpp3/toolbox.html)

## 다음 확장

CSV 입력과 스키마 검증, 실제 공개 데이터의 모델 학습 예제, 예측 거리별 시계열 평가, 이미지/SVG 내보내기 등을 독립 컬렉션으로 확장할 수 있습니다.
