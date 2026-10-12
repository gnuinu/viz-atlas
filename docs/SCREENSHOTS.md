# README 화면 캡처

`images/`의 PNG는 Viz Atlas v0.3.0의 실제 화면을 Playwright로 캡처한 것입니다. 설명을 위해 차트나 수치를 합성·수정하지 않습니다. 모든 화면의 데이터 자체는 앱에서 생성하는 교육용 합성 데이터입니다.

| 파일                         | 화면 및 조건                                                  |
| ---------------------------- | ------------------------------------------------------------- |
| `prediction-lab.png`         | 라이트 · 특정 설비의 성능 저하 · 정확도 진단                  |
| `conditional-comparison.png` | 라이트 · 특정 설비의 성능 저하 · 조건별 비교 전체 화면        |
| `interval-calibration.png`   | 라이트 · 과신 시나리오 · 모델 A의 구간 보정 카드              |
| `visualization-library.png`  | 라이트 · 시각화 라이브러리 전체 화면                          |
| `dark-mode.png`              | 다크 · 특정 설비의 성능 저하 · 정확도 진단                    |
| `mobile.png`                 | 라이트 · 정확도 진단 · 390 × 1800px (차트까지 담은 긴 뷰포트) |

데스크톱 뷰포트는 1440 × 1440px이며 전체 화면·카드 캡처의 이미지 높이는 콘텐츠에 따라 달라집니다. 새 브라우저 컨텍스트와 기본 모델 A를 사용하며, 테마는 시스템 설정을 모사합니다. 글꼴 로딩 완료를 기다리고 애니메이션을 비활성화합니다.

## 공개 데모에서 재생성

저장소 루트에서 실행합니다. 기본 대상은 GitHub Pages 데모입니다.

```bash
npm ci
npx playwright install chromium
node scripts/capture-docs.mjs
```

Chrome이 설치되어 있다면 `PW_CHROME=1 node scripts/capture-docs.mjs`를 사용할 수 있습니다.

## 배포 전 로컬 화면에서 재생성

먼저 빌드와 미리보기를 실행합니다.

```bash
npm run build
npm run preview -- --port 4173
```

다른 터미널에서 실행합니다.

```bash
node scripts/capture-docs.mjs http://127.0.0.1:4173/viz-atlas/
```

캡처 후 이미지의 글꼴·차트·잘림을 확인하고 README의 이미지 경로와 앱 버전 설명도 함께 갱신합니다. PNG는 문서용이며 앱 배포 파일에는 포함되지 않습니다.
