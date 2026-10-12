export type Scenario = 'balanced' | 'bias' | 'hetero' | 'equipment' | 'drift' | 'overconfident'
export type Model = 'A' | 'B'
export type Machine = '전체' | 'EQ-01' | 'EQ-02' | 'EQ-03'
export type View = 'diagnostics' | 'comparison' | 'uncertainty' | 'time'
export const actualBands = ['40-50', '50-60', '60-70', '70-80', '80-90', '90-100'] as const
export type ActualBand = 'all' | (typeof actualBands)[number]
export type HeatMetric = 'mae' | 'bias' | 'within'
export type Observation = {
  id: string
  index: number
  actual: number
  predicted: number
  residual: number
  absoluteError: number
  machine: Exclude<Machine, '전체'>
  date: string
  lower: number
  upper: number
}
export const machines: Machine[] = ['전체', 'EQ-01', 'EQ-02', 'EQ-03']
export const scenarios: {
  id: Scenario
  name: string
  title: string
  description: string
  takeaway: string
}[] = [
  {
    id: 'balanced',
    name: '균형 잡힌 예측',
    title: '좋은 예측은 어떤 모양일까요?',
    description: '오차가 한 방향에 치우치지 않는 기본 시나리오입니다.',
    takeaway:
      '점이 대각선 주변에 모이고, 잔차는 0을 중심으로 퍼집니다. 허용 오차 충족률을 함께 확인하세요.',
  },
  {
    id: 'bias',
    name: '일정한 과대예측',
    title: '잘 따라가지만, 항상 높게 예측한다면?',
    description: '모델 A가 실제값보다 평균적으로 높게 예측합니다.',
    takeaway:
      '상관관계가 높아도 예측은 편향될 수 있습니다. 대각선 위로 이동한 점과 음수 쪽으로 치우친 잔차를 확인하세요.',
  },
  {
    id: 'hetero',
    name: '큰 값에서 커지는 오차',
    title: '큰 값에서도 같은 정확도를 유지할까요?',
    description: '실제값이 커질수록 오차의 산포가 증가합니다.',
    takeaway:
      '잔차의 부채꼴 모양은 오차 크기가 일정하지 않다는 단서입니다. 전체 평균과 값의 범위별 성능을 함께 살펴보세요.',
  },
  {
    id: 'equipment',
    name: '특정 설비의 성능 저하',
    title: '평균에 가려진 오차를 발견하세요.',
    description: 'EQ-03에서만 과소예측과 큰 오차가 발생합니다.',
    takeaway:
      'EQ-03을 선택해 보세요. 전체 평균으로는 보이지 않던 설비의 편향이 선명해집니다. 모델 B는 이 현상을 완화한 가상 비교 모델입니다.',
  },
  {
    id: 'drift',
    name: '시간에 따른 성능 저하',
    title: '어제의 정확도가 오늘도 유지될까요?',
    description: '평가 기간 후반부터 예측이 점차 실제값에서 벗어납니다.',
    takeaway:
      '시간별 추이에서 후반의 오차 변화를 확인하세요. 과거 보정 데이터로 만든 예측 구간도 분포가 바뀌면 포함률이 떨어질 수 있습니다.',
  },
  {
    id: 'overconfident',
    name: '지나치게 좁은 예측 구간',
    title: '정확해 보이는 예측, 얼마나 믿을 수 있나요?',
    description: '점 예측은 같지만 모델 A의 예측 구간만 의도적으로 좁힙니다.',
    takeaway:
      '좁은 구간이 항상 좋은 구간은 아닙니다. 불확실성 탭에서 목표 포함률 90%와 실제 포함률을 비교하세요.',
  },
]

// Seeded, independent streams make every scenario/model comparison reproducible.
function random(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function normal(rng: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng())
}
function generateRaw(
  scenario: Scenario,
  model: Model,
  count: number,
  seed: number,
  calibration: boolean,
) {
  const rng = random(seed)
  return Array.from({ length: count }, (_, index) => {
    const actual = 40 + 60 * rng()
    const machine = machines[(index % 3) + 1] as Observation['machine']
    const z = normal(rng)
    let sigma = model === 'A' ? 2.5 : 1.8
    let bias = 0
    if (scenario === 'bias') bias = model === 'A' ? 5.5 : 1.1
    if (scenario === 'hetero') sigma = (0.9 + (actual - 40) * 0.1) * (model === 'A' ? 1 : 0.65)
    if (scenario === 'equipment' && machine === 'EQ-03') {
      bias = model === 'A' ? -6 : -1.5
      sigma = model === 'A' ? 3.7 : 2.2
    }
    if (scenario === 'drift' && !calibration)
      bias = Math.max(0, index / (count - 1) - 0.5) * (model === 'A' ? -21 : -8)
    // Same point forecasts isolate the effect of interval width in this scenario.
    if (scenario === 'overconfident') sigma = 2.5
    const predicted = actual + bias + sigma * z
    const residual = actual - predicted
    return {
      id: `S-${String(index + 1).padStart(3, '0')}`,
      index,
      actual,
      predicted,
      residual,
      absoluteError: Math.abs(residual),
      machine,
      date: new Date(Date.UTC(2026, 8, 1 + Math.floor(index / 12))).toISOString().slice(0, 10),
    }
  })
}

export function conformalQuantile(errors: number[], coverage = 0.9) {
  if (!errors.length) throw new Error('Calibration data must not be empty')
  if (!(coverage > 0 && coverage < 1)) throw new Error('Coverage must be between zero and one')
  const sorted = [...errors].sort((a, b) => a - b)
  const rank = Math.ceil((sorted.length + 1) * coverage)
  return rank > sorted.length ? Infinity : sorted[rank - 1]
}
export function intervalRadius(scenario: Scenario, model: Model, coverage = 0.9) {
  const calibration = generateRaw(scenario, model, 240, 84291, true)
  let radius = conformalQuantile(
    calibration.map((d) => d.absoluteError),
    coverage,
  )
  if (scenario === 'overconfident' && model === 'A') radius *= 0.35
  return radius
}
export function createDataset(scenario: Scenario, model: Model): Observation[] {
  const radius = intervalRadius(scenario, model)
  return generateRaw(scenario, model, 360, 17523, false).map((d) => ({
    ...d,
    lower: d.predicted - radius,
    upper: d.predicted + radius,
  }))
}
export function metrics(data: Observation[], tolerance: number) {
  if (!data.length) return { count: 0, mae: 0, rmse: 0, bias: 0, within: 0, coverage: 0, width: 0 }
  const mean = (fn: (d: Observation) => number) => data.reduce((s, d) => s + fn(d), 0) / data.length
  return {
    count: data.length,
    mae: mean((d) => d.absoluteError),
    rmse: Math.sqrt(mean((d) => d.residual ** 2)),
    bias: mean((d) => d.residual),
    within: mean((d) => Number(d.absoluteError <= tolerance)) * 100,
    coverage: mean((d) => Number(d.actual >= d.lower && d.actual <= d.upper)) * 100,
    width: mean((d) => d.upper - d.lower),
  }
}
export function quantile(values: number[], p: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * p
  const low = Math.floor(index)
  return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low)
}
export function boxStats(values: number[]) {
  const q1 = quantile(values, 0.25),
    median = quantile(values, 0.5),
    q3 = quantile(values, 0.75)
  const iqr = q3 - q1
  const inside = values.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr)
  return { q1, median, q3, low: Math.min(...inside), high: Math.max(...inside) }
}
export type Settings = {
  scenario: Scenario
  model: Model
  machine: Machine
  tolerance: number
  view: View
  band: ActualBand
  heatMetric: HeatMetric
}
export const defaults: Settings = {
  scenario: 'equipment',
  model: 'A',
  machine: '전체',
  tolerance: 5,
  view: 'diagnostics',
  band: 'all',
  heatMetric: 'mae',
}
export function parseSettings(search: string): Settings {
  const p = new URLSearchParams(search)
  const scenario = p.get('scenario'),
    machine = p.get('machine'),
    view = p.get('view')
  const rawTolerance = p.get('tolerance'),
    tolerance = rawTolerance?.trim() ? Number(rawTolerance) : NaN
  return {
    scenario: scenarios.some((s) => s.id === scenario) ? (scenario as Scenario) : defaults.scenario,
    model: p.get('model') === 'B' ? 'B' : 'A',
    machine: machines.includes(machine as Machine) ? (machine as Machine) : defaults.machine,
    tolerance: Number.isFinite(tolerance)
      ? Math.min(12, Math.max(1, Math.round(tolerance * 2) / 2))
      : defaults.tolerance,
    view: ['diagnostics', 'comparison', 'uncertainty', 'time'].includes(view ?? '')
      ? (view as View)
      : defaults.view,
    band: actualBands.includes(p.get('band') as (typeof actualBands)[number])
      ? (p.get('band') as ActualBand)
      : 'all',
    heatMetric: ['mae', 'bias', 'within'].includes(p.get('heatMetric') ?? '')
      ? (p.get('heatMetric') as HeatMetric)
      : 'mae',
  }
}
export function settingsSearch(settings: Settings) {
  return new URLSearchParams(Object.entries(settings).map(([k, v]) => [k, String(v)])).toString()
}
export function toCSV(data: Observation[], settings: Settings) {
  const header =
    'sample_id,date,machine,actual_nm,predicted_nm,residual_nm,absolute_error_nm,lower_90_nm,upper_90_nm,within_tolerance,tolerance_nm,scenario,model,actual_band'
  return (
    '\uFEFF' +
    [
      header,
      ...data.map((d) =>
        [
          d.id,
          d.date,
          d.machine,
          d.actual.toFixed(4),
          d.predicted.toFixed(4),
          d.residual.toFixed(4),
          d.absoluteError.toFixed(4),
          d.lower.toFixed(4),
          d.upper.toFixed(4),
          d.absoluteError <= settings.tolerance,
          settings.tolerance,
          settings.scenario,
          settings.model,
          settings.band,
        ].join(','),
      ),
    ].join('\r\n')
  )
}
