import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { scaleLinear } from 'd3-scale'
import type { ScaleLinear } from 'd3-scale'
import { curveStepAfter, line } from 'd3-shape'
import { boxStats, machines, metrics } from './data'
import type { Machine, Model, Observation } from './data'

type Scale = ScaleLinear<number, number>
type Plot = {
  x: Scale
  y: Scale
  left: number
  top: number
  right: number
  bottom: number
  width: number
}
export function extent(values: number[], pad = 0.08): [number, number] {
  if (!values.length) return [0, 1]
  const lo = Math.min(...values),
    hi = Math.max(...values),
    span = hi - lo || 1
  return [lo - span * pad, hi + span * pad]
}
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(400)
  useEffect(() => {
    const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}
export function Frame({
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  title,
  square = false,
  xTicks,
  xFormat,
  children,
}: {
  xDomain: [number, number]
  yDomain: [number, number]
  xLabel: string
  yLabel: string
  title: string
  square?: boolean
  xTicks?: number[]
  xFormat?: (v: number) => string
  children: (p: Plot) => ReactNode
}) {
  const { ref, width } = useWidth()
  const top = 18,
    height = square ? Math.min(420, width + 8) : 330
  const side = Math.min(width - 78, height - 72)
  const left = square ? 54 + (width - 78 - side) / 2 : 54
  const right = square ? left + side : width - 20,
    bottom = square ? top + side : height - 54
  const x = scaleLinear().domain(xDomain).range([left, right])
  const y = scaleLinear().domain(yDomain).range([bottom, top])
  const ticksX = xTicks ?? x.ticks(width < 380 ? 4 : 5),
    ticksY = y.ticks(5)
  return (
    <div className="chart-frame" ref={ref}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title}
      >
        <title>{title}</title>
        {ticksY.map((v) => (
          <g key={v}>
            <line x1={left} x2={right} y1={y(v)} y2={y(v)} className="grid-line" />
            <text x={left - 10} y={y(v) + 4} textAnchor="end" className="tick">
              {Number(v.toFixed(1))}
            </text>
          </g>
        ))}
        {ticksX.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={top} y2={bottom} className="grid-line vertical" />
            <text x={x(v)} y={bottom + 21} textAnchor="middle" className="tick">
              {xFormat ? xFormat(v) : Number(v.toFixed(1))}
            </text>
          </g>
        ))}
        <line x1={left} x2={right} y1={bottom} y2={bottom} className="axis-line" />
        <text x={(left + right) / 2} y={height - 8} textAnchor="middle" className="axis-label">
          {xLabel}
        </text>
        <text
          transform={`translate(14 ${(top + bottom) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="axis-label"
        >
          {yLabel}
        </text>
        {children({ x, y, left, right, top, bottom, width })}
      </svg>
    </div>
  )
}
export function ScatterPlot({
  data,
  tolerance,
  selectedId,
  onSelect,
  residual = false,
}: {
  data: Observation[]
  tolerance: number
  selectedId: string | null
  onSelect: (id: string) => void
  residual?: boolean
}) {
  const [hover, setHover] = useState<Observation | null>(null)
  const shown = hover && data.find((d) => d.id === hover.id)
  const domain = extent(data.flatMap((d) => [d.actual, d.predicted]))
  const yDomain: [number, number] = residual
    ? extent([...data.map((d) => d.residual), tolerance, -tolerance, 0])
    : domain
  return (
    <div className="scatter-wrap">
      <Frame
        xDomain={residual ? extent(data.map((d) => d.predicted)) : domain}
        yDomain={yDomain}
        xLabel={residual ? '예측값 (nm)' : '실제값 (nm)'}
        yLabel={residual ? '잔차 · 실제 − 예측 (nm)' : '예측값 (nm)'}
        square={!residual}
        title={
          residual
            ? '예측값에 따른 잔차. 잔차는 실제값에서 예측값을 뺀 값입니다.'
            : '실제값과 예측값 비교. 대각선에 가까울수록 오차가 작습니다.'
        }
      >
        {(p) => {
          const [lo, hi] = p.x.domain()
          const path = residual
            ? `M${p.left},${p.y(tolerance)}H${p.right}V${p.y(-tolerance)}H${p.left}Z`
            : `M${p.x(lo)},${p.y(lo)}L${p.x(lo)},${p.y(Math.min(hi, lo + tolerance))}L${p.x(Math.max(lo, hi - tolerance))},${p.y(hi)}L${p.x(hi)},${p.y(hi)}L${p.x(hi)},${p.y(Math.max(lo, hi - tolerance))}L${p.x(Math.min(hi, lo + tolerance))},${p.y(lo)}Z`
          const nearest = (event: React.PointerEvent<SVGRectElement>) => {
            const rect = event.currentTarget.ownerSVGElement!.getBoundingClientRect()
            const px = ((event.clientX - rect.left) * p.width) / rect.width,
              py = event.clientY - rect.top
            let distance = Infinity,
              found = data[0]
            for (const d of data) {
              const dist =
                (p.x(residual ? d.predicted : d.actual) - px) ** 2 +
                (p.y(residual ? d.residual : d.predicted) - py) ** 2
              if (dist < distance) {
                distance = dist
                found = d
              }
            }
            return found
          }
          return (
            <>
              <path d={path} className="tolerance-band" />
              <line
                x1={p.left}
                x2={p.right}
                y1={residual ? p.y(0) : p.y(lo)}
                y2={residual ? p.y(0) : p.y(hi)}
                className="reference-line"
              />
              {data.map((d) => (
                <circle
                  key={d.id}
                  cx={p.x(residual ? d.predicted : d.actual)}
                  cy={p.y(residual ? d.residual : d.predicted)}
                  r={d.id === selectedId || d.id === shown?.id ? 6 : 3.2}
                  className={`data-point ${d.absoluteError > tolerance ? 'outside' : ''} ${selectedId && d.id !== selectedId ? 'dimmed' : ''} ${d.id === selectedId ? 'selected' : ''}`}
                />
              ))}
              <rect
                x={p.left}
                y={p.top}
                width={p.right - p.left}
                height={p.bottom - p.top}
                fill="transparent"
                onPointerMove={(e) => setHover(nearest(e))}
                onPointerLeave={() => setHover(null)}
                onPointerDown={(e) => onSelect(nearest(e).id)}
              />
              {!residual && (
                <text x={p.right - 6} y={p.top + 15} textAnchor="end" className="reference-label">
                  y = x
                </text>
              )}
            </>
          )
        }}
      </Frame>
      {shown && (
        <div className="chart-tooltip" role="tooltip">
          <strong>
            {shown.id} · {shown.machine}
          </strong>
          <span>
            실제 {shown.actual.toFixed(2)} / 예측 {shown.predicted.toFixed(2)} nm
          </span>
          <span>잔차 {shown.residual.toFixed(2)} nm</span>
        </div>
      )}
    </div>
  )
}

export function BoxPlot({
  data,
  machine,
  onMachine,
  tolerance,
}: {
  data: Observation[]
  machine: Machine
  onMachine: (m: Machine) => void
  tolerance: number
}) {
  const domain = extent([...data.map((d) => d.residual), -tolerance, tolerance])
  return (
    <Frame
      xDomain={[0.5, 3.5]}
      yDomain={domain}
      xLabel="설비 · 전체 데이터에서 비교"
      yLabel="잔차 (nm)"
      title="설비별 잔차 박스 플롯. 박스는 사분위 범위, 가운데 선은 중앙값입니다."
      xTicks={[1, 2, 3]}
      xFormat={(n) => machines[n]}
    >
      {(p) => (
        <>
          <rect
            x={p.left}
            y={p.y(tolerance)}
            width={p.right - p.left}
            height={p.y(-tolerance) - p.y(tolerance)}
            className="tolerance-band"
          />
          <line x1={p.left} x2={p.right} y1={p.y(0)} y2={p.y(0)} className="reference-line" />
          {machines.slice(1).map((m, i) => {
            const points = data.filter((d) => d.machine === m),
              b = boxStats(points.map((d) => d.residual)),
              x = p.x(i + 1)
            const muted = machine !== '전체' && machine !== m,
              w = Math.min(48, (p.right - p.left) / 5)
            return (
              <g key={m} opacity={muted ? 0.25 : 1}>
                {points.map((d) => (
                  <circle
                    key={d.id}
                    cx={x + Math.sin(d.index * 7.13) * w * 0.58}
                    cy={p.y(d.residual)}
                    r="2.2"
                    className="box-sample"
                  />
                ))}
                <line x1={x} x2={x} y1={p.y(b.low)} y2={p.y(b.high)} className="box-whisker" />
                {[b.low, b.high].map((v) => (
                  <line
                    key={v}
                    x1={x - w / 3}
                    x2={x + w / 3}
                    y1={p.y(v)}
                    y2={p.y(v)}
                    className="box-whisker"
                  />
                ))}
                <rect
                  x={x - w / 2}
                  width={w}
                  y={p.y(b.q3)}
                  height={Math.max(1, p.y(b.q1) - p.y(b.q3))}
                  className="box-body"
                />
                <line
                  x1={x - w / 2}
                  x2={x + w / 2}
                  y1={p.y(b.median)}
                  y2={p.y(b.median)}
                  className="box-median"
                />
                <rect
                  x={x - w}
                  width={w * 2}
                  y={p.top}
                  height={p.bottom - p.top}
                  fill="transparent"
                  onClick={() => onMachine(machine === m ? '전체' : m)}
                  className="clickable"
                />
                <text x={x} y={p.top + 12} textAnchor="middle" className="tick">
                  n={points.length}
                </text>
              </g>
            )
          })}
        </>
      )}
    </Frame>
  )
}

export function ECDFPlot({
  a,
  b,
  tolerance,
  model,
}: {
  a: Observation[]
  b: Observation[]
  tolerance: number
  model: Model
}) {
  const max =
    Math.max(tolerance, ...a.map((d) => d.absoluteError), ...b.map((d) => d.absoluteError)) * 1.07
  return (
    <Frame
      xDomain={[0, max]}
      yDomain={[0, 104]}
      xLabel="절대오차 허용 범위 (nm)"
      yLabel="누적 비율 (%)"
      title="모델 A와 B의 절대오차 누적분포. 같은 허용 범위에서 높은 선이 더 많은 예측을 포함합니다."
    >
      {(p) => (
        <>
          <rect
            x={p.left}
            y={p.top}
            width={p.x(tolerance) - p.left}
            height={p.bottom - p.top}
            className="tolerance-band"
          />
          {(
            [
              ['A', a],
              ['B', b],
            ] as const
          ).map(([m, data]) => {
            const sorted = [...data].sort((x, y) => x.absoluteError - y.absoluteError)
            const points = [
              { error: 0, percent: 0 },
              ...sorted.map((d, i) => ({
                error: d.absoluteError,
                percent: ((i + 1) / data.length) * 100,
              })),
              { error: max, percent: 100 },
            ]
            const path = line<(typeof points)[number]>()
              .x((d) => p.x(d.error))
              .y((d) => p.y(d.percent))
              .curve(curveStepAfter)(points)
            return (
              <path
                key={m}
                d={path ?? ''}
                className={`ecdf-line model-${m} ${m === model ? 'active-model' : ''}`}
              />
            )
          })}
          <line
            x1={p.x(tolerance)}
            x2={p.x(tolerance)}
            y1={p.top}
            y2={p.bottom}
            className="reference-line"
          />
          <circle
            cx={p.x(tolerance)}
            cy={p.y(metrics(model === 'A' ? a : b, tolerance).within)}
            r="5"
            className={`ecdf-marker model-${model}`}
          />
          <text
            x={Math.min(p.right - 3, p.x(tolerance) + 8)}
            y={p.bottom - 10}
            textAnchor={p.x(tolerance) > p.right - 70 ? 'end' : 'start'}
            className="reference-label"
          >
            ±{tolerance} nm
          </text>
        </>
      )}
    </Frame>
  )
}

export function IntervalPlot({
  data,
  selectedId,
  onSelect,
}: {
  data: Observation[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const sorted = [...data].sort((a, b) => a.predicted - b.predicted)
  const count = Math.min(36, sorted.length)
  const shown = Array.from(
    { length: count },
    (_, i) => sorted[Math.round((i * (sorted.length - 1)) / Math.max(1, count - 1))],
  )
  return (
    <Frame
      xDomain={[0, count + 1]}
      yDomain={extent(shown.flatMap((d) => [d.actual, d.lower, d.upper]))}
      xLabel="표시 순서 · 예측값 기준 정렬"
      yLabel="박막 두께 (nm)"
      title={`예측값 순서로 정렬한 ${count}개 샘플의 예측 구간과 실제값. 전체 표본으로 포함률을 계산합니다.`}
    >
      {(p) =>
        shown.map((d, i) => {
          const x = p.x(i + 1),
            missed = d.actual < d.lower || d.actual > d.upper
          return (
            <g key={d.id} className={missed ? 'interval missed' : 'interval'}>
              <line x1={x} x2={x} y1={p.y(d.lower)} y2={p.y(d.upper)} className="interval-line" />
              <line
                x1={x - 3}
                x2={x + 3}
                y1={p.y(d.predicted)}
                y2={p.y(d.predicted)}
                className="interval-center"
              />
              <circle
                cx={x}
                cy={p.y(d.actual)}
                r={selectedId === d.id ? 6 : 3.5}
                className="actual-marker"
              />
              <rect
                x={x - 5}
                y={p.y(Math.max(d.upper, d.actual)) - 6}
                width="10"
                height={p.y(Math.min(d.lower, d.actual)) - p.y(Math.max(d.upper, d.actual)) + 12}
                fill="transparent"
                onClick={() => onSelect(d.id)}
                className="clickable"
              >
                <title>
                  {d.id}: 실제 {d.actual.toFixed(2)}, 구간 {d.lower.toFixed(2)}–{d.upper.toFixed(2)}{' '}
                  nm
                </title>
              </rect>
            </g>
          )
        })
      }
    </Frame>
  )
}
export function CoveragePlot({ data }: { data: Observation[] }) {
  return (
    <Frame
      xDomain={[0.5, 3.5]}
      yDomain={[0, 105]}
      xLabel="설비"
      yLabel="실제 포함률 (%)"
      title="설비별 예측 구간의 실제 포함률과 90% 목표선"
      xTicks={[1, 2, 3]}
      xFormat={(n) => machines[n]}
    >
      {(p) => (
        <>
          <line x1={p.left} x2={p.right} y1={p.y(90)} y2={p.y(90)} className="reference-line" />
          <text x={p.right - 4} y={p.y(90) - 8} className="reference-label" textAnchor="end">
            목표 90%
          </text>
          {machines.slice(1).map((m, i) => {
            const subset = data.filter((d) => d.machine === m),
              value = metrics(subset, 5).coverage
            if (!subset.length) return null
            const w = Math.min(48, (p.right - p.left) / 6)
            return (
              <g key={m}>
                <rect
                  x={p.x(i + 1) - w / 2}
                  y={p.y(value)}
                  width={w}
                  height={p.y(0) - p.y(value)}
                  className="coverage-bar"
                  rx="3"
                />
                <text
                  x={p.x(i + 1)}
                  y={p.y(value) - 7}
                  className="reference-label"
                  textAnchor="middle"
                >
                  {value.toFixed(1)}%
                </text>
              </g>
            )
          })}
        </>
      )}
    </Frame>
  )
}
export function TimePlot({
  data,
  error = false,
  drift = false,
}: {
  data: Observation[]
  error?: boolean
  drift?: boolean
}) {
  const dates = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
  const daily = dates.map((date, i) => {
    const subset = data.filter((d) => d.date === date),
      m = metrics(subset, 5)
    return {
      day: i + 1,
      actual: subset.reduce((s, d) => s + d.actual, 0) / subset.length,
      predicted: subset.reduce((s, d) => s + d.predicted, 0) / subset.length,
      ...m,
    }
  })
  const keys = error ? (['mae', 'bias'] as const) : (['actual', 'predicted'] as const)
  return (
    <Frame
      xDomain={[0.5, 30.5]}
      yDomain={extent([
        ...daily.filter((d) => d.count > 0).flatMap((d) => keys.map((k) => d[k])),
        ...(error ? [0] : []),
      ])}
      xLabel="2026년 9월 · 일별 집계"
      yLabel={error ? '일별 오차 (nm)' : '일평균 박막 두께 (nm)'}
      title={
        error ? '시간에 따른 일별 평균 절대오차와 평균 잔차' : '시간에 따른 일평균 실제값과 예측값'
      }
      xTicks={[1, 7, 14, 21, 30]}
      xFormat={(n) => `${n}일`}
    >
      {(p) => (
        <>
          {drift && (
            <>
              <rect
                x={p.x(16)}
                y={p.top}
                width={p.right - p.x(16)}
                height={p.bottom - p.top}
                className="drift-band"
              />
              <text x={p.x(16) + 6} y={p.top + 14} className="reference-label">
                변화 시작
              </text>
            </>
          )}
          {error && (
            <line x1={p.left} x2={p.right} y1={p.y(0)} y2={p.y(0)} className="reference-line" />
          )}
          {keys.map((key, i) => (
            <path
              key={key}
              d={
                line<(typeof daily)[number]>()
                  .defined((d) => d.count > 0)
                  .x((d) => p.x(d.day))
                  .y((d) => p.y(d[key]))(daily) ?? ''
              }
              className={`time-line series-${i}`}
            />
          ))}
          {keys.flatMap((key, series) =>
            daily
              .filter((d) => d.count > 0)
              .map((d) => (
                <circle
                  key={`${key}-${d.day}`}
                  cx={p.x(d.day)}
                  cy={p.y(d[key])}
                  r="3"
                  className={`time-dot series-${series}`}
                  data-day={d.day}
                  data-series={key}
                >
                  <title>
                    {d.day}일 · n={d.count} · {key}: {d[key].toFixed(2)} nm
                  </title>
                </circle>
              )),
          )}
        </>
      )}
    </Frame>
  )
}
