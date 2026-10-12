import { useTranslation } from './i18n'
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { line } from 'd3-shape'
import { ChartCard } from './ChartCard'
import { Frame, extent } from './Charts'
import { actualBands, machines } from './data'
import type { HeatMetric, Observation, Settings } from './data'
import { calibrationSeries, heatmapCells, improvementSummary, pairModels } from './diagnostics'

const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`
const labels: Record<HeatMetric, string> = {
  mae: '평균 절대오차',
  bias: '평균 잔차',
  within: '허용 오차 충족률',
}
const curveColors = [
  'var(--chart-a)',
  'var(--chart-b)',
  'var(--chart-amber)',
  'var(--chart-negative)',
]
const curveDashes = ['', '7 3', '2 3', '10 3 2 3']

export function ComparisonView({
  allA,
  allB,
  a,
  b,
  settings,
  selectedId,
  onSelect,
  onUpdate,
}: {
  allA: Observation[]
  allB: Observation[]
  a: Observation[]
  b: Observation[]
  settings: Settings
  selectedId: string | null
  onSelect: (id: string) => void
  onUpdate: (patch: Partial<Settings>) => void
}) {
  const { t } = useTranslation()

  const { model, machine, band, tolerance, heatMetric } = settings
  const cellsA = useMemo(() => heatmapCells(allA, tolerance), [allA, tolerance])
  const cellsB = useMemo(() => heatmapCells(allB, tolerance), [allB, tolerance])
  const cells = model === 'A' ? cellsA : cellsB
  const allCells = [...cellsA, ...cellsB]
  const maximum =
    heatMetric === 'within' ? 100 : Math.max(1, ...allCells.map((c) => Math.abs(c[heatMetric])))
  const pairs = useMemo(() => pairModels(a, b), [a, b])
  const summary = improvementSummary(pairs)
  const ranked = [...pairs].sort((x, y) => x.delta - y.delta)
  const extremes = [
    ...new Map([...ranked.slice(0, 4), ...ranked.slice(-4)].map((p) => [p.a.id, p])).values(),
  ]
  const selected = pairs.find((p) => p.a.id === selectedId)
  if (selected && !extremes.some((p) => p.a.id === selectedId)) extremes.unshift(selected)
  const yMax = Math.max(1, ...pairs.map((p) => Math.abs(p.delta))) * 1.15
  return (
    <>
      <div className="section-intro">
        <div>
          <span className="eyebrow">{t('조건별로 자세히 보기')}</span>
          <h2>{t('어떤 조건에서, 어떤 샘플이 달라졌을까요?')}</h2>
          <p>{t('히트맵의 셀을 선택하면 같은 표본으로 모델 A와 B를 비교합니다.')}</p>
        </div>
      </div>
      <ChartCard
        number="09"
        subtitle="CONDITIONAL ERROR HEATMAP"
        title={t('설비 × 실제값 구간')}
        tag={t('모델 {0} · 전체 조건 지도', model)}
        footer={t(
          '숫자 아래는 표본 수입니다. † 15개 미만은 적은 표본을 알리는 데모 표시이며, 통계적 유의성 기준이 아닙니다. 셀을 다시 누르면 조건이 해제됩니다.',
        )}
      >
        <div className="heatmap-toolbar">
          <div className="metric-switch" aria-label={t('히트맵 지표')}>
            {(['mae', 'bias', 'within'] as const).map((value) => (
              <button
                key={value}
                aria-pressed={heatMetric === value}
                onClick={() => onUpdate({ heatMetric: value })}
              >
                {t(labels[value])}
              </button>
            ))}
          </div>
          <span>
            {heatMetric === 'within' ? '%' : 'nm'} {t('· A/B 공통 색 범위')}
          </span>
        </div>
        <p className="horizontal-hint">
          {t('좌우로 스크롤하면 모든 실제값 구간을 볼 수 있습니다.')}
        </p>
        <div className="heatmap-scroll">
          <div className="heatmap-grid">
            <span className="heatmap-axis">{t('실제값 (nm) →')}</span>
            {actualBands.map((value) => (
              <span className="heatmap-band" key={value}>
                {value.replace('-', '–')}
              </span>
            ))}
            {machines.slice(1).map((equipment) => (
              <div className="heatmap-row" key={equipment}>
                <span className="heatmap-machine">{equipment}</span>
                {cells
                  .filter((c) => c.machine === equipment)
                  .map((cell) => {
                    const active = machine === cell.machine && band === cell.band
                    const dim =
                      (machine !== '전체' && machine !== cell.machine) ||
                      (band !== 'all' && band !== cell.band)
                    return (
                      <button
                        key={cell.band}
                        className={`heat-cell ${active ? 'selected' : ''} ${dim ? 'dimmed' : ''}`}
                        style={
                          {
                            '--heat-level': `${Math.min(100, (Math.abs(cell[heatMetric]) / maximum) * 100)}%`,
                            '--heat-start':
                              heatMetric === 'bias' ? 'var(--heat-neutral)' : 'var(--heat-low)',
                            '--heat-end':
                              heatMetric === 'bias'
                                ? cell.bias < 0
                                  ? 'var(--heat-over)'
                                  : 'var(--heat-under)'
                                : 'var(--heat-high)',
                          } as CSSProperties
                        }
                        disabled={!cell.count}
                        aria-pressed={active}
                        aria-label={t(
                          '{0}, {1} nm, {2} {3}, 표본 {4}개',
                          cell.machine,
                          cell.band,
                          t(labels[heatMetric]),
                          cell[heatMetric].toFixed(2),
                          cell.count,
                        )}
                        onClick={() =>
                          onUpdate(
                            active
                              ? { machine: '전체', band: 'all' }
                              : { machine: cell.machine, band: cell.band },
                          )
                        }
                      >
                        <strong>
                          {cell.count
                            ? heatMetric === 'bias'
                              ? signed(cell.bias)
                              : cell[heatMetric].toFixed(heatMetric === 'within' ? 1 : 2)
                            : '—'}
                        </strong>
                        <small>
                          n={cell.count}
                          {cell.count < 15 ? ' †' : ''}
                        </small>
                      </button>
                    )
                  })}
              </div>
            ))}
          </div>
        </div>
        <div className="heatmap-key">
          <span>{heatMetric === 'bias' ? t('{0} · 과대예측', (-maximum).toFixed(1)) : '0'}</span>
          <i className={heatMetric === 'bias' ? 'diverging' : undefined} />
          <span>
            {maximum.toFixed(1)}
            {heatMetric === 'bias'
              ? t('· 과소예측')
              : heatMetric === 'within'
                ? t('% · 높을수록 좋음')
                : t('nm · 낮을수록 좋음')}
          </span>
        </div>
        <p className="panel-caption">
          {' '}
          {t('지도는 모든 조건을 유지합니다. 현재 평가:')} {t(machine)} ·{' '}
          {band === 'all' ? t('전체 실제값') : `${band.replace('-', '–')} nm`} · {a.length}{' '}
          {t('개')}{' '}
        </p>
      </ChartCard>
      <div className="comparison-grid">
        <ChartCard
          number="10"
          subtitle="PAIRED MODEL IMPROVEMENT"
          title={t('같은 샘플, 달라진 오차')}
          tag="A → B"
          footer={t(
            '개선도 = |오차 A| − |오차 B|. 0 위는 B의 개선, 0 아래는 악화입니다. 모델 선택과 관계없이 A → B 방향을 유지합니다.',
          )}
        >
          <div className="legend">
            <span>
              <i className="teal" />
              {t('B 개선')}{' '}
            </span>
            <span>
              <i className="coral" />
              {t('B 악화')}{' '}
            </span>
            <span>
              <i className="neutral" /> {t('동일')}{' '}
            </span>
          </div>
          <Frame
            xDomain={extent(pairs.map((p) => p.a.actual))}
            yDomain={[-yMax, yMax]}
            xLabel={t('실제값 (nm)')}
            yLabel={t('절대오차 개선도 (nm)')}
            title={t(
              '모델 B의 표본별 개선도. {0}개 개선, {1}개 악화, {2}개 동일.',
              summary.improved,
              summary.worsened,
              summary.tied,
            )}
          >
            {(p) => (
              <>
                <line x1={p.left} x2={p.right} y1={p.y(0)} y2={p.y(0)} className="reference-line" />
                {pairs.map((pair) => (
                  <circle
                    key={pair.a.id}
                    cx={p.x(pair.a.actual)}
                    cy={p.y(pair.delta)}
                    r={selectedId === pair.a.id ? 6 : 4}
                    className={`pair-point ${pair.outcome} ${selectedId === pair.a.id ? 'selected' : ''}`}
                    onClick={() => onSelect(pair.a.id)}
                  >
                    <title>
                      {pair.a.id} · {pair.a.machine} {t('· 개선도')} {signed(pair.delta)}{' '}
                      {t('nm · 오차 A')} {pair.a.absoluteError.toFixed(2)}, B{' '}
                      {pair.b.absoluteError.toFixed(2)} nm
                    </title>
                  </circle>
                ))}
              </>
            )}
          </Frame>
        </ChartCard>
        <section className="improvement-panel" aria-label={t('모델 개선 요약')}>
          <span className="eyebrow">{t('모델의 변화를 읽는 방법')}</span>
          <h2>
            {' '}
            {t('평균이 좋아져도')} <br /> {t('모두 좋아지지는 않습니다.')}{' '}
          </h2>
          <div className="delta-total">
            <strong>{signed(summary.meanDelta)}</strong>
            <span>
              {' '}
              {t('nm 평균 개선')} <br />
              MAE A − MAE B
            </span>
          </div>
          <div className="outcome-counts">
            {(
              [
                ['improved', t('개선'), summary.improved],
                ['worsened', t('악화'), summary.worsened],
                ['tied', t('동일'), summary.tied],
              ] as const
            ).map(([key, label, count]) => (
              <div key={key} className={key}>
                <span>{label}</span>
                <strong>
                  {count}
                  <small>{t('개')}</small>
                </strong>
                <span>{summary.count ? ((count / summary.count) * 100).toFixed(1) : '0.0'}%</span>
              </div>
            ))}
          </div>
          <p>
            {t(
              '같은 ID·실제값·설비·날짜를 가진 {0}쌍의 비교입니다. 일부 표본의 개선은 모델 변경에 따른 인과 효과나 유의한 성능 향상을 증명하지 않습니다.',
              summary.count,
            )}
          </p>
        </section>
      </div>
      <section className="paired-table-section">
        <div className="table-heading">
          <h3>{t('개선과 악화가 큰 샘플')}</h3>
          <span>{t('양쪽 끝 최대 4개씩 · 선택한 샘플 포함')}</span>
        </div>
        <div className="table-scroll">
          <table className="paired-table">
            <thead>
              <tr>
                <th>{t('샘플')}</th>
                <th>{t('설비')}</th>
                <th>{t('실제값')}</th>
                <th>{t('|오차 A|')}</th>
                <th>{t('|오차 B|')}</th>
                <th>{t('개선도 (nm)')}</th>
              </tr>
            </thead>
            <tbody>
              {extremes.map((pair) => (
                <tr key={pair.a.id} className={selectedId === pair.a.id ? 'selected-row' : ''}>
                  <td>
                    <button
                      className="sample-button"
                      aria-pressed={selectedId === pair.a.id}
                      onClick={() => onSelect(pair.a.id)}
                    >
                      {pair.a.id}
                    </button>
                  </td>
                  <td>{pair.a.machine}</td>
                  <td>{pair.a.actual.toFixed(2)}</td>
                  <td>{pair.a.absoluteError.toFixed(2)}</td>
                  <td>{pair.b.absoluteError.toFixed(2)}</td>
                  <td className={pair.outcome}>
                    {signed(pair.delta)} ·{' '}
                    {pair.outcome === 'improved'
                      ? t('개선')
                      : pair.outcome === 'worsened'
                        ? t('악화')
                        : t('동일')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export function CalibrationPanel({
  allData,
  settings,
}: {
  allData: Observation[]
  settings: Settings
}) {
  const { t } = useTranslation()

  const { scenario, model, band, machine } = settings
  const series = useMemo(
    () => calibrationSeries(scenario, model, allData, band),
    [scenario, model, allData, band],
  )
  return (
    <ChartCard
      number="11"
      subtitle="INTERVAL CALIBRATION CURVE"
      title={t('목표를 높이면, 실제 포함률도 따라올까요?')}
      className="calibration-card"
      tag={t('모델 {0}', model)}
      footer={t(
        '대각선 아래는 목표보다 낮은 포함률입니다. 표본의 변동으로 선 위·아래에 놓일 수 있습니다. 구간 폭과 표본 수를 함께 확인하고, 집단별 보장으로 해석하지 마세요.',
      )}
    >
      <p className="panel-caption">
        {' '}
        {t('별도 보정 표본 240개로 목표별 구간을 계산합니다.')}{' '}
        {band === 'all' ? t('전체 실제값 범위') : t('실제값 {0} nm', band.replace('-', '–'))}
        {t('에서 모든 설비를 함께 비교하며, 선택한 설비는 굵게 표시합니다.')}{' '}
      </p>
      <div className="calibration-layout">
        <div>
          <div className="calibration-legend">
            {series.map((s, i) => (
              <span key={t(s.machine)} className={machine === s.machine ? 'active' : ''}>
                <svg width="21" height="8" aria-hidden="true">
                  <line
                    x1="0"
                    x2="21"
                    y1="4"
                    y2="4"
                    stroke={curveColors[i]}
                    strokeWidth="2"
                    strokeDasharray={curveDashes[i]}
                  />
                </svg>
                {t(s.machine)} <small>n={s.count}</small>
              </span>
            ))}
          </div>
          <Frame
            xDomain={[0, 100]}
            yDomain={[0, 100]}
            xLabel={t('목표 포함률 (%)')}
            yLabel={t('실제 포함률 (%)')}
            title={t(
              '50, 70, 80, 90, 95% 목표의 전체 및 설비별 실제 포함률. 표에 정확한 값과 구간 폭이 제공됩니다.',
            )}
            square
            xTicks={[0, 25, 50, 75, 100]}
          >
            {(p) => (
              <>
                <line
                  x1={p.x(0)}
                  x2={p.x(100)}
                  y1={p.y(0)}
                  y2={p.y(100)}
                  className="reference-line"
                />
                {[...series]
                  .sort((a, b) => Number(a.machine === machine) - Number(b.machine === machine))
                  .map((s) => {
                    const i = series.indexOf(s)
                    return (
                      <g
                        key={t(s.machine)}
                        className="calibration-series"
                        data-machine={t(s.machine)}
                      >
                        <path
                          d={
                            line<(typeof s.points)[number]>()
                              .defined((d) => d.coverage !== null)
                              .x((d) => p.x(d.target))
                              .y((d) => p.y(d.coverage!))(s.points) ?? ''
                          }
                          fill="none"
                          stroke={curveColors[i]}
                          strokeDasharray={curveDashes[i]}
                          strokeWidth={s.machine === machine ? 3 : 1.6}
                          opacity={s.machine === machine ? 1 : 0.7}
                        />
                        {s.points
                          .filter((d) => d.coverage !== null)
                          .map((d) => (
                            <circle
                              key={d.target}
                              cx={p.x(d.target)}
                              cy={p.y(d.coverage!)}
                              r={s.machine === machine ? 4 : 3}
                              fill={curveColors[i]}
                            >
                              <title>
                                {t(s.machine)}
                                {t(': 목표')} {d.target}
                                {t('%, 실제')} {d.coverage!.toFixed(1)}
                                {t('%, 폭')} {d.width.toFixed(2)} nm, n={d.count}
                              </title>
                            </circle>
                          ))}
                      </g>
                    )
                  })}
              </>
            )}
          </Frame>
        </div>
        <div className="calibration-table-wrap">
          <h3>{t('포함률과 구간 폭 함께 읽기')}</h3>
          <p>{t('실제 포함률 (%) · 폭은 모든 설비에 공통')}</p>
          <div className="table-scroll">
            <table className="calibration-table">
              <thead>
                <tr>
                  <th>{t('목표')}</th>
                  {series.map((s) => (
                    <th key={t(s.machine)} className={s.machine === machine ? 'active-column' : ''}>
                      {t(s.machine)}
                      <small>n={s.count}</small>
                    </th>
                  ))}
                  <th>{t('폭 (nm)')}</th>
                </tr>
              </thead>
              <tbody>
                {series[0].points.map((d, index) => (
                  <tr key={d.target}>
                    <th>{d.target}%</th>
                    {series.map((s) => (
                      <td
                        key={t(s.machine)}
                        className={s.machine === machine ? 'active-column' : ''}
                      >
                        {s.points[index].coverage?.toFixed(1) ?? '—'}
                      </td>
                    ))}
                    <td>{d.width.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="calibration-note">
            {' '}
            {t(
              '필터는 평가 표본만 바꿉니다. 선택한 설비나 실제값 구간으로 재보정하지 않습니다. 표본이 없는 집단은 ‘—’로 표시합니다.',
            )}{' '}
          </p>
        </div>
      </div>
    </ChartCard>
  )
}
