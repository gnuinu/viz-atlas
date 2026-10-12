import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  FlaskConical,
  GitFork,
  Layers3,
  Link2,
  MoveUpRight,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  ScanLine,
  ScatterChart,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import { BoxPlot, CoveragePlot, ECDFPlot, IntervalPlot, ScatterPlot, TimePlot } from './Charts'
import {
  createDataset,
  defaults,
  machines,
  metrics,
  parseSettings,
  scenarios,
  settingsSearch,
  toCSV,
} from './data'
import type { Model, Settings, View } from './data'

type Page = 'lab' | 'patterns' | 'guide'
function readPage(): Page {
  return location.hash === '#patterns' ? 'patterns' : location.hash === '#guide' ? 'guide' : 'lab'
}
function ChartCard({
  number,
  title,
  subtitle,
  tag,
  className = '',
  children,
  footer,
}: {
  number: string
  title: string
  subtitle: string
  tag?: string
  className?: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <section className={`chart-card ${className}`}>
      <header className="chart-heading">
        <div>
          <div className="chart-kicker">
            {number}
            <span>{subtitle}</span>
          </div>
          <h2>{title}</h2>
        </div>
        {tag && <span className="subtle-tag">{tag}</span>}
      </header>
      {children}
      <div className="chart-footer">{footer}</div>
    </section>
  )
}
function Legend({
  type = 'scatter',
}: {
  type?: 'scatter' | 'models' | 'interval' | 'time' | 'error'
}) {
  const entries =
    type === 'models'
      ? [
          ['teal', '모델 A'],
          ['purple dashed', '모델 B'],
        ]
      : type === 'interval'
        ? [
            ['teal', '실제값 · 구간 내'],
            ['coral', '실제값 · 구간 밖'],
            ['interval-key', '예측 구간'],
          ]
        : type === 'time'
          ? [
              ['teal', '실제값'],
              ['purple dashed', '예측값'],
            ]
          : type === 'error'
            ? [
                ['teal', 'MAE'],
                ['purple dashed', '평균 잔차'],
              ]
            : [
                ['teal', '허용 오차 이내'],
                ['coral', '허용 오차 초과'],
              ]
  return (
    <div className="legend">
      {entries.map(([c, text]) => (
        <span key={text}>
          <i className={c} />
          {text}
        </span>
      ))}
    </div>
  )
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => parseSettings(location.search))
  const [page, setPage] = useState<Page>(readPage)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => matchMedia('(max-width: 800px)').matches)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSamples, setShowSamples] = useState(false)
  const [toast, setToast] = useState('')
  const { scenario, model, machine, tolerance, view } = settings
  useEffect(() => {
    history.replaceState(
      null,
      '',
      `${location.pathname}?${settingsSearch(settings)}${location.hash}`,
    )
  }, [settings])
  useEffect(() => {
    const media = matchMedia('(max-width: 800px)')
    const onChange = () => setIsMobile(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  useEffect(() => {
    if (!sidebarOpen) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [sidebarOpen])
  useEffect(() => {
    const onHash = () => {
      setPage(readPage())
      setSidebarOpen(false)
      window.scrollTo({ top: 0 })
    }
    const onPop = () => {
      setSettings(parseSettings(location.search))
      setSelectedId(null)
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onPop)
    }
  }, [])
  useEffect(() => {
    if (toast) {
      const id = window.setTimeout(() => setToast(''), 3500)
      return () => clearTimeout(id)
    }
  }, [toast])
  useEffect(() => {
    document.title = `Viz Atlas — ${page === 'lab' ? 'Prediction Lab' : page === 'patterns' ? '시각화 라이브러리' : '읽는 법 & 노트'}`
  }, [page])
  const allA = useMemo(() => createDataset(scenario, 'A'), [scenario])
  const allB = useMemo(() => createDataset(scenario, 'B'), [scenario])
  const dataA = useMemo(
    () => allA.filter((d) => machine === '전체' || d.machine === machine),
    [allA, machine],
  )
  const dataB = useMemo(
    () => allB.filter((d) => machine === '전체' || d.machine === machine),
    [allB, machine],
  )
  const allData = model === 'A' ? allA : allB,
    data = model === 'A' ? dataA : dataB
  const m = metrics(data, tolerance),
    comparison = metrics(model === 'A' ? dataB : dataA, tolerance)
  const currentScenario = scenarios.find((s) => s.id === scenario)!
  const selected = data.find((d) => d.id === selectedId)
  const sampleRows = [...data].sort((a, b) => b.absoluteError - a.absoluteError).slice(0, 8)
  if (selected && !sampleRows.some((d) => d.id === selected.id)) sampleRows.unshift(selected)
  function update(patch: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...patch }))
    setSelectedId(null)
  }
  function select(id: string) {
    setSelectedId((old) => (old === id ? null : id))
  }
  function launch(nextView: View) {
    const next = { ...settings, view: nextView }
    history.pushState(null, '', `${location.pathname}?${settingsSearch(next)}#lab`)
    setSettings(next)
    setSelectedId(null)
    setPage('lab')
    setSidebarOpen(false)
    window.scrollTo({ top: 0 })
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href)
      setToast('현재 시나리오와 필터가 담긴 링크를 복사했습니다.')
    } catch {
      setToast('링크를 복사하지 못했습니다. 주소창의 URL로 같은 화면을 공유할 수 있습니다.')
    }
  }
  function downloadCSV() {
    const url = URL.createObjectURL(
      new Blob([toCSV(data, settings)], { type: 'text/csv;charset=utf-8;' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `viz-atlas-${scenario}-model-${model}-${machine === '전체' ? 'all' : machine}.csv`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setToast(`${data.length}개 샘플의 CSV를 내려받았습니다.`)
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          aria-label="메뉴 닫기"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`} inert={isMobile && !sidebarOpen}>
        <a href="#lab" className="brand" aria-label="Viz Atlas 홈">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} width="35" height="35" alt="" />
          <span>
            viz<span className="brand-light">atlas</span>
            <span className="brand-period">.</span>
          </span>
        </a>
        <div className="sidebar-caption">A FIELD GUIDE TO DATA</div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav aria-label="메인 메뉴">
          <a
            href="#lab"
            className={page === 'lab' ? 'nav-item active' : 'nav-item'}
            aria-current={page === 'lab' ? 'page' : undefined}
          >
            <FlaskConical size={18} />
            Prediction Lab
            <span className="nav-dot" />
          </a>
          <a
            href="#patterns"
            className={page === 'patterns' ? 'nav-item active' : 'nav-item'}
            aria-current={page === 'patterns' ? 'page' : undefined}
          >
            <Layers3 size={18} />
            시각화 라이브러리<span className="nav-count">06</span>
          </a>
          <a
            href="#guide"
            className={page === 'guide' ? 'nav-item active' : 'nav-item'}
            aria-current={page === 'guide' ? 'page' : undefined}
          >
            <BookOpen size={18} />
            읽는 법 & 노트
          </a>
        </nav>
        <div className="sidebar-section-label collection-label">THIS COLLECTION</div>
        <div className="collection-link">
          <span className="collection-line" />
          <span>
            Actual vs. Predicted<small>회귀 모델의 예측 진단</small>
          </span>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="mini-spark">
              <Sparkles size={16} />
            </span>
            <strong>숫자 너머의 패턴.</strong>
            <p>
              직접 바꿔보고, 발견하고,
              <br />더 명확하게 설명하세요.
            </p>
            <a href="#guide">
              시작 가이드 <ArrowUpRight size={14} />
            </a>
          </div>
          <a
            className="github-link"
            href="https://github.com/gnuinu/viz-atlas"
            target="_blank"
            rel="noreferrer"
          >
            <GitFork size={16} />
            GitHub
            <ArrowUpRight size={13} />
          </a>
          <div className="sidebar-version">
            VIZ ATLAS <span>v0.1</span>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="메뉴 열기"
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {page === 'lab'
                ? 'Prediction Lab'
                : page === 'patterns'
                  ? '시각화 라이브러리'
                  : '읽는 법 & 노트'}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="local-indicator">
              <i />
              브라우저에서 실행
            </span>
            <a
              href="https://github.com/gnuinu/viz-atlas"
              className="icon-button"
              aria-label="GitHub 저장소"
              target="_blank"
              rel="noreferrer"
            >
              <GitFork size={19} />
            </a>
          </div>
        </header>
        <main id="main-content">
          {page === 'lab' ? (
            <>
              <div className="page-intro">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-line" />
                    THE PREDICTION COLLECTION <span className="edition">/ 001</span>
                  </div>
                  <h1>
                    Actual vs. Predicted<span className="title-dot">.</span>
                  </h1>
                  <p className="intro-copy">
                    예측은 얼마나 정확할까요? 오차 속 패턴을 직접 탐색해 보세요.
                  </p>
                </div>
                <div className="intro-actions">
                  <button className="button" onClick={copyLink}>
                    <Link2 size={15} />
                    링크 공유
                  </button>
                  <button className="button dark" onClick={downloadCSV}>
                    <ArrowDownToLine size={15} />
                    CSV 내보내기
                  </button>
                </div>
              </div>
              <div className="dataset-strip">
                <span className="dataset-icon">
                  <ScanLine size={17} />
                </span>
                <strong>반도체 박막 두께 예측</strong>
                <span className="strip-divider" />
                <span>설비 3대</span>
                <span className="strip-dot">·</span>
                <span>2026.09.01 – 09.30</span>
                <span className="synthetic-tag">합성 데이터</span>
              </div>
              <section className="control-panel" aria-label="데이터 탐색 설정">
                <div className="control-main">
                  <label className="scenario-field">
                    <span className="field-label">
                      <SlidersHorizontal size={13} />
                      시나리오
                    </span>
                    <span className="select-wrap">
                      <select
                        value={scenario}
                        onChange={(e) =>
                          update({ scenario: e.target.value as Settings['scenario'] })
                        }
                      >
                        {scenarios.map((s) => (
                          <option value={s.id} key={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={15} />
                    </span>
                  </label>
                  <fieldset className="model-field">
                    <legend className="field-label">비교 모델</legend>
                    <div className="segmented">
                      {(['A', 'B'] as Model[]).map((value) => (
                        <button
                          key={value}
                          onClick={() => update({ model: value })}
                          aria-pressed={model === value}
                          className={model === value ? 'selected' : ''}
                        >
                          모델 {value}
                          {value === 'B' && <span className="model-hint">개선</span>}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="tolerance-field">
                    <span className="field-label">
                      허용 오차{' '}
                      <output className="tolerance-value">
                        ±{tolerance.toFixed(1)} <span>nm</span>
                      </output>
                    </span>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      step="0.5"
                      value={tolerance}
                      onChange={(e) => update({ tolerance: Number(e.target.value) })}
                      aria-label="허용 오차"
                      aria-valuetext={`플러스 마이너스 ${tolerance} 나노미터`}
                    />
                    <span className="range-endpoints">
                      <span>엄격하게 · 1</span>
                      <span>12 · 넓게</span>
                    </span>
                  </label>
                </div>
                <div className="control-bottom">
                  <div className="machine-filter">
                    <span className="field-label">설비</span>
                    {machines.map((value) => (
                      <button
                        key={value}
                        aria-pressed={machine === value}
                        onClick={() => update({ machine: value })}
                        className={machine === value ? 'filter-chip active' : 'filter-chip'}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <button
                    className="text-button reset"
                    onClick={() => {
                      setSettings(defaults)
                      setSelectedId(null)
                    }}
                  >
                    <RotateCcw size={13} />
                    초기화
                  </button>
                </div>
              </section>

              <div className="metric-grid" aria-label="선택된 데이터의 평가 지표">
                <div className="metric">
                  <div className="metric-label">
                    평균 절대오차 <span>MAE</span>
                  </div>
                  <div className="metric-value">
                    {m.mae.toFixed(2)}
                    <small>nm</small>
                  </div>
                  <div className="metric-note">예측이 평균적으로 벗어난 거리</div>
                </div>
                <div className="metric">
                  <div className="metric-label">
                    제곱근 평균제곱오차 <span>RMSE</span>
                  </div>
                  <div className="metric-value">
                    {m.rmse.toFixed(2)}
                    <small>nm</small>
                  </div>
                  <div className="metric-note">큰 오차에 더 민감한 지표</div>
                </div>
                <div className="metric">
                  <div className="metric-label">
                    평균 잔차 <span>BIAS</span>
                  </div>
                  <div className="metric-value">
                    {m.bias > 0 ? '+' : ''}
                    {m.bias.toFixed(2)}
                    <small>nm</small>
                  </div>
                  <div className="metric-note">
                    {Math.abs(m.bias) < 0.5
                      ? '0에 가까울수록 방향성 편향이 작음'
                      : m.bias > 0
                        ? '양수: 실제값보다 낮게 예측'
                        : '음수: 실제값보다 높게 예측'}
                  </div>
                </div>
                <div className="metric highlight">
                  <div className="metric-label">
                    허용 오차 충족률 <span>WITHIN ±{tolerance}</span>
                  </div>
                  <div className="metric-value" data-testid="within-value">
                    {m.within.toFixed(1)}
                    <small>%</small>
                    <MoveUpRight size={23} />
                  </div>
                  <div className="metric-note">
                    {data.filter((d) => d.absoluteError <= tolerance).length} / {data.length}개
                    샘플이 기준 충족
                  </div>
                </div>
              </div>

              <div className="analysis-toolbar">
                <div className="analysis-tabs" role="tablist" aria-label="분석 보기">
                  {(
                    [
                      { id: 'diagnostics', label: '정확도 진단' },
                      { id: 'uncertainty', label: '불확실성' },
                      { id: 'time', label: '시간별 추이' },
                    ] as { id: View; label: string }[]
                  ).map((tab) => (
                    <button
                      role="tab"
                      id={`tab-${tab.id}`}
                      aria-controls="analysis-panel"
                      aria-selected={view === tab.id}
                      key={tab.id}
                      onClick={() => update({ view: tab.id })}
                      className={view === tab.id ? 'active' : ''}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <span className="sample-count">
                  <i />
                  {data.length} observations
                </span>
              </div>
              <div id="analysis-panel" role="tabpanel" aria-labelledby={`tab-${view}`}>
                {view === 'diagnostics' ? (
                  <>
                    <div className="chart-grid">
                      <ChartCard
                        number="01"
                        subtitle="PARITY PLOT"
                        title="실제값과 예측값"
                        tag={`모델 ${model}`}
                        footer={
                          <>
                            <span className="footer-mark">↗</span>대각선에 가까울수록 정확한
                            예측입니다. 음영은 허용 오차 범위입니다.
                          </>
                        }
                      >
                        <Legend />
                        <ScatterPlot
                          data={data}
                          tolerance={tolerance}
                          selectedId={selectedId}
                          onSelect={select}
                        />
                      </ChartCard>
                      <ChartCard
                        number="02"
                        subtitle="RESIDUAL PLOT"
                        title="오차 속 패턴"
                        tag="실제 − 예측"
                        footer={
                          <>
                            <span className="footer-mark">±</span>0 위는 과소예측, 아래는
                            과대예측입니다. 오차의 방향과 산포를 살펴보세요.
                          </>
                        }
                      >
                        <Legend />
                        <ScatterPlot
                          data={data}
                          tolerance={tolerance}
                          selectedId={selectedId}
                          onSelect={select}
                          residual
                        />
                      </ChartCard>
                    </div>
                    <div className="insight-strip">
                      <span className="insight-icon">
                        <Sparkles size={18} />
                      </span>
                      <div>
                        <strong>{currentScenario.title}</strong>
                        <p>{currentScenario.takeaway}</p>
                      </div>
                      <a href="#guide" aria-label="차트 해석 가이드">
                        <ArrowUpRight size={20} />
                      </a>
                    </div>
                    <div className="chart-grid">
                      <ChartCard
                        number="03"
                        subtitle="ERROR BY EQUIPMENT"
                        title="설비별 오차 분포"
                        tag="전체 설비"
                        footer="박스: 25–75% · 가운데 선: 중앙값 · 수염: 1.5 IQR 내 관측값. 설비를 클릭하면 필터가 적용됩니다."
                      >
                        <BoxPlot
                          data={allData}
                          machine={machine}
                          onMachine={(value) => update({ machine: value })}
                          tolerance={tolerance}
                        />
                      </ChartCard>
                      <ChartCard
                        number="04"
                        subtitle="CUMULATIVE ERROR"
                        title="어디까지 허용할 수 있을까요?"
                        tag="A / B 비교"
                        footer={`현재 기준 ±${tolerance} nm에서 모델 ${model}은 ${m.within.toFixed(1)}%, 모델 ${model === 'A' ? 'B' : 'A'}는 ${comparison.within.toFixed(1)}%를 충족합니다.`}
                      >
                        <Legend type="models" />
                        <ECDFPlot a={dataA} b={dataB} tolerance={tolerance} model={model} />
                      </ChartCard>
                    </div>
                  </>
                ) : view === 'uncertainty' ? (
                  <>
                    <div className="section-intro">
                      <div>
                        <span className="eyebrow">BEYOND A SINGLE NUMBER</span>
                        <h2>예측 범위도 검증이 필요합니다.</h2>
                        <p>
                          240개 별도 보정 표본으로 구간을 계산하고, 360개 평가 표본 중 선택한
                          설비에서 검증합니다.
                        </p>
                      </div>
                      <div className="interval-metrics">
                        <div>
                          <span>목표 포함률</span>
                          <strong>
                            90<small>%</small>
                          </strong>
                        </div>
                        <div>
                          <span>실제 포함률</span>
                          <strong>
                            {m.coverage.toFixed(1)}
                            <small>%</small>
                          </strong>
                        </div>
                        <div>
                          <span>평균 구간 폭</span>
                          <strong>
                            {m.width.toFixed(2)}
                            <small>nm</small>
                          </strong>
                        </div>
                      </div>
                    </div>
                    <div className="chart-grid">
                      <ChartCard
                        number="05"
                        subtitle="PREDICTION INTERVALS"
                        title="예측 구간과 실제값"
                        tag="36개 표시"
                        footer="예측값 순서로 정렬해 고르게 뽑은 36개입니다. 세로선은 예측 구간, 가로 눈금은 예측값, 점은 실제값입니다."
                      >
                        <Legend type="interval" />
                        <IntervalPlot data={data} selectedId={selectedId} onSelect={select} />
                      </ChartCard>
                      <ChartCard
                        number="06"
                        subtitle="EMPIRICAL COVERAGE"
                        title="설비마다 같은 신뢰도일까요?"
                        tag={machine}
                        footer="점선은 목표 포함률 90%입니다. 전체 포함률이 높아도 특정 설비의 포함률은 낮을 수 있습니다."
                      >
                        <CoveragePlot data={data} />
                      </ChartCard>
                    </div>
                    <div className="method-note">
                      <CircleHelp size={19} />
                      <div>
                        <strong>
                          {scenario === 'overconfident' && model === 'A'
                            ? '이 구간은 의도적으로 좁힌 실패 사례입니다.'
                            : '이 구간은 합성 데이터의 split conformal 예제입니다.'}
                        </strong>
                        <p>
                          {scenario === 'overconfident' && model === 'A'
                            ? '모델 A의 구간 폭을 보정된 구간의 35%로 축소했습니다. 모델 B로 바꾸면 같은 점 예측의 보정된 구간을 볼 수 있습니다.'
                            : '실제값과 예측값의 절대오차로 구간 폭을 보정했습니다. 교환가능성 등 가정이 필요하며, 모든 설비나 개별 예측에 90%를 보장하지 않습니다. 시간에 따른 분포 변화 시나리오는 이 한계를 보여줍니다.'}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="section-intro">
                      <div>
                        <span className="eyebrow">A MODEL OVER TIME</span>
                        <h2>시간이 흐르면, 오차도 달라집니다.</h2>
                        <p>
                          일별 평균을 비교합니다. 각 날짜는 전체 12개, 설비별 4개 표본으로
                          집계됩니다.
                        </p>
                      </div>
                      <span className="subtle-tag">2026년 9월 · 30일</span>
                    </div>
                    <div className="chart-grid">
                      <ChartCard
                        number="07"
                        subtitle="ACTUAL & PREDICTED"
                        title="일별 실제값과 예측값"
                        tag="일평균"
                        footer="일평균은 개별 샘플의 큰 오차를 가릴 수 있습니다. 정확도 진단의 산점도와 함께 확인하세요."
                      >
                        <Legend type="time" />
                        <TimePlot data={data} drift={scenario === 'drift'} />
                      </ChartCard>
                      <ChartCard
                        number="08"
                        subtitle="ERROR OVER TIME"
                        title="성능 변화 추적"
                        tag="일별 집계"
                        footer="MAE는 오차의 크기, 평균 잔차는 방향을 나타냅니다. 잔차의 부호가 상쇄되어도 MAE는 남습니다."
                      >
                        <Legend type="error" />
                        <TimePlot data={data} error drift={scenario === 'drift'} />
                      </ChartCard>
                    </div>
                    <div className="method-note">
                      <CircleHelp size={19} />
                      <div>
                        <strong>시간에 따른 진단과 미래 예측은 구분합니다.</strong>
                        <p>
                          이 예제는 날짜가 있는 합성 회귀 예측을 진단합니다. 미래 시계열 예측의
                          rolling-origin 검증이나 예측 거리별 평가는 아직 포함하지 않습니다.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {selected && (
                <div className="selection-strip" aria-live="polite">
                  <span className="selection-label">선택한 샘플</span>
                  <strong>{selected.id}</strong>
                  <span>
                    {selected.machine} · {selected.date}
                  </span>
                  <span>
                    실제 <b>{selected.actual.toFixed(2)}</b>
                  </span>
                  <span>
                    예측 <b>{selected.predicted.toFixed(2)}</b>
                  </span>
                  <span>
                    잔차 <b>{selected.residual.toFixed(2)} nm</b>
                  </span>
                  <button
                    className="icon-button"
                    aria-label="샘플 선택 해제"
                    onClick={() => setSelectedId(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <section className="samples-section">
                <button
                  className="samples-toggle"
                  onClick={() => setShowSamples(!showSamples)}
                  aria-expanded={showSamples}
                  aria-controls="sample-table"
                >
                  <span>
                    <ScanLine size={17} />
                    <strong>샘플 탐색</strong>
                    <span>절대오차가 큰 상위 8개 · 키보드로도 선택할 수 있습니다</span>
                  </span>
                  <ChevronDown size={18} className={showSamples ? 'rotated' : ''} />
                </button>
                {showSamples && (
                  <div className="table-scroll" id="sample-table">
                    <table>
                      <thead>
                        <tr>
                          <th>샘플</th>
                          <th>설비</th>
                          <th>실제값 (nm)</th>
                          <th>예측값 (nm)</th>
                          <th>잔차 (nm)</th>
                          <th>허용 오차</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sampleRows.map((d) => (
                          <tr key={d.id} className={selectedId === d.id ? 'selected-row' : ''}>
                            <td>
                              <button
                                className="sample-button"
                                onClick={() => select(d.id)}
                                aria-pressed={selectedId === d.id}
                              >
                                {d.id}
                                <ArrowUpRight size={12} />
                              </button>
                            </td>
                            <td>{d.machine}</td>
                            <td>{d.actual.toFixed(2)}</td>
                            <td>{d.predicted.toFixed(2)}</td>
                            <td>{d.residual.toFixed(2)}</td>
                            <td>
                              <span
                                className={
                                  d.absoluteError <= tolerance ? 'status-pass' : 'status-fail'
                                }
                              >
                                {d.absoluteError <= tolerance ? '이내' : '초과'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <div className="data-note">
                <span>
                  <i />
                  REPRODUCIBLE BY DESIGN
                </span>
                <p>고정 시드의 합성 데이터 · 가상 모델 A/B · 단위 nm · 잔차 = 실제 − 예측</p>
                <a href="#guide">
                  데이터와 계산 방법 <ArrowUpRight size={13} />
                </a>
              </div>
            </>
          ) : page === 'patterns' ? (
            <>
              <div className="page-intro">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-line" />
                    THE VISUAL TOOLKIT
                  </div>
                  <h1>
                    시각화 라이브러리<span className="title-dot">.</span>
                  </h1>
                  <p className="intro-copy">
                    좋은 질문에, 알맞은 차트. 예제와 해석을 함께 모았습니다.
                  </p>
                </div>
                <span className="collection-badge">01 COLLECTION / 06 PATTERNS</span>
              </div>
              <div className="pattern-grid">
                {[
                  {
                    title: 'Actual vs. Predicted',
                    ko: '실제값과 얼마나 가까울까?',
                    desc: '대각선과 허용 오차 영역으로 예측의 일치도를 살펴봅니다.',
                    type: 'diagnostics',
                    no: '01',
                    label: '일치도',
                    chart: 'scatter',
                  },
                  {
                    title: 'Residual Plot',
                    ko: '어디에서 체계적으로 틀릴까?',
                    desc: '편향, 비선형 패턴, 오차 크기의 변화를 찾아봅니다.',
                    type: 'diagnostics',
                    no: '02',
                    label: '오차 구조',
                    chart: 'residual',
                  },
                  {
                    title: 'Grouped Box Plot',
                    ko: '어떤 설비에서 문제가 생길까?',
                    desc: '집단별 잔차의 중앙값, 산포, 이상치를 비교합니다.',
                    type: 'diagnostics',
                    no: '03',
                    label: '집단 비교',
                    chart: 'box',
                  },
                  {
                    title: 'Error ECDF',
                    ko: '기준을 만족하는 예측은 몇 %일까?',
                    desc: '허용 오차에 따른 충족률을 모델별로 비교합니다.',
                    type: 'diagnostics',
                    no: '04',
                    label: '업무 기준',
                    chart: 'ecdf',
                  },
                  {
                    title: 'Prediction Intervals',
                    ko: '예측 범위를 얼마나 믿을까?',
                    desc: '구간의 실제 포함률과 폭을 함께 검증합니다.',
                    type: 'uncertainty',
                    no: '05',
                    label: '불확실성',
                    chart: 'interval',
                  },
                  {
                    title: 'Performance over Time',
                    ko: '언제부터 성능이 달라졌을까?',
                    desc: '날짜별 실제값, 예측값과 오차 추이를 탐색합니다.',
                    type: 'time',
                    no: '06',
                    label: '시간 변화',
                    chart: 'time',
                  },
                ].map((p) => (
                  <button
                    className="pattern-card"
                    key={p.no}
                    onClick={() => launch(p.type as View)}
                  >
                    <div className="pattern-top">
                      <span>
                        {p.no} / {p.label}
                      </span>
                      <ArrowUpRight size={19} />
                    </div>
                    <MiniPlot kind={p.chart} />
                    <h2>{p.title}</h2>
                    <strong>{p.ko}</strong>
                    <p>{p.desc}</p>
                    <span className="pattern-cta">
                      인터랙티브 예제 열기 <ArrowRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Guide onLaunch={() => launch('diagnostics')} />
          )}
          <footer className="page-footer">
            <span>
              Viz Atlas<span className="footer-dot">·</span>Make data make sense.
            </span>
            <span>
              BUILT FOR CURIOSITY <ArrowUpRight size={12} />
            </span>
          </footer>
        </main>
      </div>
      <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">
        {toast && (
          <>
            <Check size={16} />
            {toast}
          </>
        )}
      </div>
    </div>
  )
}

function MiniPlot({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 260 110" className="mini-plot" aria-hidden="true">
      <path d="M15 5V95H250" className="mini-axis" />
      {kind === 'scatter' || kind === 'residual' ? (
        <>
          {kind === 'scatter' ? (
            <path d="M25 85L240 15" className="mini-ref" />
          ) : (
            <path d="M20 50H245" className="mini-ref" />
          )}
          {Array.from({ length: 40 }, (_, i) => (
            <circle
              key={i}
              cx={25 + i * 5.3}
              cy={
                kind === 'scatter'
                  ? 85 - i * 1.7 + Math.sin(i * 4.3) * 13
                  : 50 + Math.sin(i * 4.3) * (8 + i * 0.5)
              }
              r="2.6"
              className={i % 7 === 0 ? 'mini-coral' : 'mini-teal'}
            />
          ))}
        </>
      ) : kind === 'box' ? (
        [65, 130, 195].map((x, i) => (
          <g key={x}>
            <path d={`M${x} ${18 + i * 5}V${86 - i * 7}`} className="mini-ref" />
            <rect x={x - 18} y={35 - i * 6} width="36" height={35 + i * 5} className="mini-box" />
            <path d={`M${x - 18} ${51 - i * 3}H${x + 18}`} className="mini-ref" />
          </g>
        ))
      ) : kind === 'interval' ? (
        Array.from({ length: 18 }, (_, i) => (
          <g key={i}>
            <path d={`M${28 + i * 12} ${78 - i * 3 - 12}v24`} className="mini-interval" />
            <circle
              cx={28 + i * 12}
              cy={78 - i * 3 + Math.sin(i * 4) * 15}
              r="3"
              className="mini-teal"
            />
          </g>
        ))
      ) : kind === 'ecdf' ? (
        <>
          <path d="M20 93H40V85H55V71H70V50H90V35H120V20H165V12H245" className="mini-line" />
          <path
            d="M20 93H45V90H60V79H95V62H125V40H160V20H200V12H245"
            className="mini-line secondary"
          />
        </>
      ) : (
        <>
          <path
            d="M20 60L38 47 56 60 74 53 92 68 110 50 128 55 146 44 164 55 182 40 200 49 218 39 240 43"
            className="mini-line"
          />
          <path
            d="M20 66L38 54 56 66 74 62 92 74 110 61 128 69 146 61 164 75 182 66 200 77 218 69 240 82"
            className="mini-line secondary"
          />
        </>
      )}
    </svg>
  )
}

function Guide({ onLaunch }: { onLaunch: () => void }) {
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            NOTES FROM THE LAB
          </div>
          <h1>
            차트를 읽는 시간<span className="title-dot">.</span>
          </h1>
          <p className="intro-copy">예측을 설명할 때 알아두면 좋은 질문과 원칙들.</p>
        </div>
        <button className="button dark" onClick={onLaunch}>
          <FlaskConical size={16} />
          실험 시작하기
        </button>
      </div>
      <div className="guide-layout">
        <article className="guide-article">
          <div className="guide-lead">
            “얼마나 잘 맞는가”에서
            <br />
            <span>“어디에서, 왜 틀리는가”까지.</span>
          </div>
          <p>
            하나의 평균 지표는 모델의 모든 모습을 보여주지 못합니다. 같은 데이터의 여러 단면을 함께
            살펴보고, 실제 업무의 허용 기준으로 판단해 보세요.
          </p>
          <section>
            <span className="guide-number">01 / START HERE</span>
            <h2>고객에게 설명하는 순서</h2>
            <ol className="guide-steps">
              <li>
                <strong>업무 기준을 정합니다.</strong>
                <p>박막 두께를 몇 nm까지 틀려도 사용할 수 있을까요? 허용 오차를 먼저 설정합니다.</p>
              </li>
              <li>
                <strong>전체 일치도를 봅니다.</strong>
                <p>
                  Parity Plot의 점이 y=x 주변에 모이는지, 허용 영역 밖의 점이 어디에 있는지
                  확인합니다.
                </p>
              </li>
              <li>
                <strong>오차가 집중된 조건을 찾습니다.</strong>
                <p>
                  설비별 박스 플롯과 잔차 플롯을 연결합니다. EQ-03 선택 후 모델 A/B를 비교해 보세요.
                </p>
              </li>
              <li>
                <strong>불확실성과 시간 변화를 확인합니다.</strong>
                <p>
                  예측 구간의 포함률과 폭을 함께 보고, 특정 날짜 이후 오차가 늘어나는지 살펴봅니다.
                </p>
              </li>
            </ol>
          </section>
          <section>
            <span className="guide-number">02 / READING THE NUMBERS</span>
            <h2>지표가 말해주는 것</h2>
            <dl className="metric-glossary">
              <div>
                <dt>MAE</dt>
                <dd>절대오차의 평균. 실제 단위인 nm로 오차의 크기를 설명할 수 있습니다.</dd>
              </div>
              <div>
                <dt>RMSE</dt>
                <dd>오차를 제곱해 평균 낸 뒤 제곱근을 구합니다. 큰 오차에 더 민감합니다.</dd>
              </div>
              <div>
                <dt>BIAS</dt>
                <dd>
                  잔차(실제 − 예측)의 평균. 양수는 과소예측, 음수는 과대예측을 뜻합니다. 양·음
                  오차가 상쇄될 수 있습니다.
                </dd>
              </div>
              <div>
                <dt>충족률</dt>
                <dd>
                  |실제 − 예측| ≤ 허용 오차인 샘플의 비율입니다. 예측 구간의 포함률과는 다른 업무
                  지표입니다.
                </dd>
              </div>
              <div>
                <dt>포함률</dt>
                <dd>실제값이 예측 구간 안에 들어온 비율. 구간 폭과 함께 평가해야 합니다.</dd>
              </div>
            </dl>
          </section>
          <section>
            <span className="guide-number">03 / AVOID THE TRAPS</span>
            <h2>해석할 때 놓치기 쉬운 점</h2>
            <ul className="reading-notes">
              <li>
                실제값과 예측값의 분포가 같아도, 샘플별 예측은 틀릴 수 있습니다. 짝지어진 오차를
                확인하세요.
              </li>
              <li>
                Parity Plot의 기준선은 회귀 적합선이 아니라 y=x입니다. 두 축의 범위와 단위 비율을
                같게 유지합니다.
              </li>
              <li>
                전체 평균이 좋은 모델도 특정 설비에서는 나쁠 수 있습니다. 집단별 표본 수도 함께
                확인하세요.
              </li>
              <li>
                일반적인 모델 평가는 학습에 사용하지 않은 데이터로 합니다. 시간 순서가 중요하면 미래
                정보가 새지 않도록 분리해야 합니다.
              </li>
              <li>
                예측 구간은 개별 관측값의 범위입니다. 평균 추정치의 신뢰구간과 구분해야 합니다.
              </li>
              <li>
                실제값이 0에 가까우면 MAPE는 불안정합니다. 이 데모는 nm 단위 오차와 허용 오차
                충족률을 중심으로 구성했습니다.
              </li>
            </ul>
          </section>
          <section>
            <span className="guide-number">04 / REPRODUCIBILITY</span>
            <h2>이 예제의 데이터와 계산</h2>
            <p>
              실제 반도체 회사의 데이터를 사용하지 않습니다. 40–100 nm 범위의 가상 박막 두께와 설비
              3대, 30일의 평가 표본 360개를 고정 난수 시드로 만듭니다. 모델 A/B는 학습한 모델이
              아니라 실패 패턴을 설명하기 위해 생성한 예측값입니다.
            </p>
            <p>
              별도 시드로 만든 240개 보정 표본의 절대오차를 정렬하고, ceil((n+1) × 0.9)번째 값을
              예측 구간의 반폭으로 사용합니다. ‘좁은 예측 구간’ 시나리오에서는 모델 A의 반폭을 35%로
              축소합니다. 모델 B의 점 예측은 A와 같아, 구간 폭만 비교할 수 있습니다.
            </p>
            <p>
              집단별 분포 차이와 시간 변화에서는 전체 포함률과 집단별 포함률이 달라질 수 있습니다.
              교환가능성 가정이 깨지는 시간 변화 사례에서 90% 보장을 주장하지 않습니다. 보정 구간은
              전체 설비에서 계산하고, 설비 필터는 평가 대상만 바꿉니다.
            </p>
            <p>
              현재 링크는 시나리오·모델·설비·허용 오차·분석 탭을 저장합니다. CSV는 선택된 데이터
              전체와 예측 구간을 포함합니다.
            </p>
          </section>
          <section>
            <span className="guide-number">05 / FURTHER READING</span>
            <h2>참고 자료</h2>
            <div className="reference-list">
              <a
                href="https://scikit-learn.org/stable/modules/generated/sklearn.metrics.PredictionErrorDisplay.html"
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  <strong>scikit-learn · PredictionErrorDisplay</strong>
                  <small>실제값·예측값 비교와 잔차 시각화</small>
                </span>
                <ArrowUpRight size={18} />
              </a>
              <a
                href="https://docs.evidentlyai.com/metrics/preset_regression"
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  <strong>Evidently · Regression evaluation</strong>
                  <small>오차 진단, 취약 집단, 기준 데이터와의 비교</small>
                </span>
                <ArrowUpRight size={18} />
              </a>
              <a href="https://mapie.readthedocs.io/en/stable/" target="_blank" rel="noreferrer">
                <span>
                  <strong>MAPIE · Conformal prediction</strong>
                  <small>예측 구간, 포함률, 적용 가정</small>
                </span>
                <ArrowUpRight size={18} />
              </a>
              <a href="https://otexts.com/fpp3/toolbox.html" target="_blank" rel="noreferrer">
                <span>
                  <strong>Forecasting: Principles and Practice</strong>
                  <small>시계열 검증과 확률적 예측 평가</small>
                </span>
                <ArrowUpRight size={18} />
              </a>
            </div>
          </section>
        </article>
        <aside className="guide-aside">
          <span className="eyebrow">TRY THIS</span>
          <h3>5분 데모 코스</h3>
          <p>‘특정 설비의 성능 저하’를 선택하고, EQ-03 → 모델 B → 허용 오차 순서로 바꿔보세요.</p>
          <button className="text-button" onClick={onLaunch}>
            Prediction Lab 열기 <ArrowRight size={15} />
          </button>
          <hr />
          <span className="eyebrow">OUR CONVENTION</span>
          <code>잔차 = 실제 − 예측</code>
          <p>프로젝트 전체에서 같은 부호 규칙을 사용합니다.</p>
          <div className="guide-visual">
            <ScatterChart size={46} strokeWidth={1} />
          </div>
        </aside>
      </div>
    </>
  )
}
