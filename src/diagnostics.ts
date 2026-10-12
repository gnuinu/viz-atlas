import { actualBands, intervalRadius, machines, metrics } from './data'
import type { ActualBand, Machine, Model, Observation, Scenario } from './data'

export function inBand(actual: number, band: ActualBand) {
  if (band === 'all') return true
  const [low, high] = band.split('-').map(Number)
  return actual >= low && (actual < high || (high === 100 && actual === high))
}
export function filterObservations(data: Observation[], machine: Machine, band: ActualBand) {
  return data.filter((d) => (machine === '전체' || d.machine === machine) && inBand(d.actual, band))
}
export function heatmapCells(data: Observation[], tolerance: number) {
  return machines.slice(1).flatMap((machine) =>
    actualBands.map((band) => ({
      machine: machine as Observation['machine'],
      band,
      ...metrics(filterObservations(data, machine, band), tolerance),
    })),
  )
}
export type ModelPair = {
  a: Observation
  b: Observation
  delta: number
  outcome: 'improved' | 'worsened' | 'tied'
}
export function pairModels(a: Observation[], b: Observation[]): ModelPair[] {
  const byId = new Map(b.map((d) => [d.id, d]))
  if (
    byId.size !== b.length ||
    new Set(a.map((d) => d.id)).size !== a.length ||
    a.length !== b.length
  )
    throw new Error('Model comparison requires unique, matching sample IDs')
  return a.map((first) => {
    const second = byId.get(first.id)
    if (
      !second ||
      first.actual !== second.actual ||
      first.machine !== second.machine ||
      first.date !== second.date
    )
      throw new Error('Model comparison requires the same observed sample')
    const delta = first.absoluteError - second.absoluteError
    return {
      a: first,
      b: second,
      delta,
      outcome: delta > 1e-9 ? 'improved' : delta < -1e-9 ? 'worsened' : 'tied',
    }
  })
}
export function improvementSummary(pairs: ModelPair[]) {
  const improved = pairs.filter((p) => p.outcome === 'improved').length
  const worsened = pairs.filter((p) => p.outcome === 'worsened').length
  return {
    count: pairs.length,
    improved,
    worsened,
    tied: pairs.length - improved - worsened,
    meanDelta: pairs.length ? pairs.reduce((sum, p) => sum + p.delta, 0) / pairs.length : 0,
  }
}
export const coverageLevels = [0.5, 0.7, 0.8, 0.9, 0.95] as const
export type CalibrationPoint = {
  target: number
  coverage: number | null
  width: number
  count: number
}
export type CalibrationSeries = { machine: Machine; points: CalibrationPoint[]; count: number }

// A single, fixed calibration split supplies every radius. Evaluation labels are
// used only for scoring; filtering never refits the intervals to a selected slice.
export function calibrationSeries(
  scenario: Scenario,
  model: Model,
  data: Observation[],
  band: ActualBand,
): CalibrationSeries[] {
  const radii = coverageLevels.map((level) => intervalRadius(scenario, model, level))
  return machines.map((machine) => {
    const subset = filterObservations(data, machine, band)
    return {
      machine,
      count: subset.length,
      points: coverageLevels.map((level, i) => ({
        target: level * 100,
        count: subset.length,
        width: 2 * radii[i],
        coverage: subset.length
          ? (subset.filter((d) => d.absoluteError <= radii[i]).length / subset.length) * 100
          : null,
      })),
    }
  })
}
