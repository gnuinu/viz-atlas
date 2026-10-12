import { describe, expect, it } from 'vitest'
import {
  actualBands,
  createDataset,
  defaults,
  intervalRadius,
  metrics,
  parseSettings,
  scenarios,
  settingsSearch,
  toCSV,
} from './data'
import {
  calibrationSeries,
  filterObservations,
  heatmapCells,
  improvementSummary,
  inBand,
  pairModels,
} from './diagnostics'

const a = createDataset('equipment', 'A')
const b = createDataset('equipment', 'B')

describe('conditional diagnostics', () => {
  it('partitions boundary values into exactly one bin, including the final upper boundary', () => {
    for (const value of [40, 49.999, 50, 60, 70, 80, 90, 99.99, 100]) {
      expect(actualBands.filter((band) => inBand(value, band))).toHaveLength(1)
    }
    expect(inBand(50, '40-50')).toBe(false)
    expect(inBand(50, '50-60')).toBe(true)
    expect(inBand(100.1, '90-100')).toBe(false)
    const cells = heatmapCells(a, 5)
    expect(cells).toHaveLength(18)
    expect(cells.reduce((sum, c) => sum + c.count, 0)).toBe(a.length)
    expect(cells.reduce((sum, c) => sum + c.count * c.mae, 0) / a.length).toBeCloseTo(
      metrics(a, 5).mae,
    )
  })
  it('roundtrips slice selection and exports only the shared evaluation subset', () => {
    const settings = {
      ...defaults,
      view: 'comparison' as const,
      machine: 'EQ-03' as const,
      band: '70-80' as const,
      heatMetric: 'bias' as const,
    }
    expect(parseSettings(settingsSearch(settings))).toEqual(settings)
    expect(parseSettings('?band=70-90&heatMetric=oops')).toEqual(defaults)
    const subset = filterObservations(a, settings.machine, settings.band)
    expect(subset.length).toBeGreaterThan(0)
    expect(subset.every((d) => d.machine === 'EQ-03' && d.actual >= 70 && d.actual < 80)).toBe(true)
    const csv = toCSV(subset, settings).split('\r\n')
    expect(csv).toHaveLength(subset.length + 1)
    expect(csv.slice(1).every((row) => row.endsWith(',70-80'))).toBe(true)
  })
})

describe('paired model improvement', () => {
  it('joins by sample identity instead of row order and reconciles with aggregate MAE', () => {
    const pairs = pairModels(a, [...b].reverse())
    expect(pairs.every((p) => p.a.id === p.b.id)).toBe(true)
    const summary = improvementSummary(pairs)
    expect(summary.improved + summary.worsened + summary.tied).toBe(a.length)
    expect(summary.meanDelta).toBeCloseTo(metrics(a, 5).mae - metrics(b, 5).mae)
    expect(pairs.some((p) => p.outcome === 'worsened')).toBe(true)
    expect(pairs.some((p) => p.outcome === 'improved')).toBe(true)
  })
  it('rejects unmatched, duplicated, or different observations', () => {
    expect(() => pairModels(a, b.slice(1))).toThrow()
    expect(() => pairModels(a, [b[1], ...b.slice(1)])).toThrow()
    expect(() => pairModels(a, [{ ...b[0], actual: b[0].actual + 1 }, ...b.slice(1)])).toThrow()
    expect(() => pairModels(a, [{ ...b[0], date: '2026-10-01' }, ...b.slice(1)])).toThrow()
  })
  it('reports ties for identical point predictions, regardless of interval width', () => {
    const summary = improvementSummary(
      pairModels(createDataset('overconfident', 'A'), createDataset('overconfident', 'B')),
    )
    expect(summary).toEqual({ count: 360, improved: 0, worsened: 0, tied: 360, meanDelta: 0 })
    expect(improvementSummary([]).count).toBe(0)
  })
})

describe('held-out interval calibration', () => {
  it('matches the existing 90% intervals and increases coverage and width with the target', () => {
    for (const scenario of scenarios) {
      for (const model of ['A', 'B'] as const) {
        const data = createDataset(scenario.id, model)
        for (const series of calibrationSeries(scenario.id, model, data, 'all')) {
          const p90 = series.points.find((p) => p.target === 90)!
          const m = metrics(filterObservations(data, series.machine, 'all'), 5)
          expect(p90.coverage).toBeCloseTo(m.coverage)
          expect(p90.width).toBeCloseTo(m.width)
          for (let i = 1; i < series.points.length; i++) {
            expect(series.points[i].width).toBeGreaterThanOrEqual(series.points[i - 1].width)
            expect(series.points[i].coverage!).toBeGreaterThanOrEqual(
              series.points[i - 1].coverage!,
            )
          }
        }
      }
    }
  })
  it('never uses evaluation errors or selected slices to refit intervals', () => {
    const reference = calibrationSeries('equipment', 'A', a, 'all')[0].points
    const modified = a.map((d) => ({ ...d, absoluteError: 1e6 }))
    const filtered = calibrationSeries('equipment', 'A', modified, '70-80')
    for (const series of filtered) {
      expect(series.points.map((p) => p.width)).toEqual(reference.map((p) => p.width))
      expect(series.points.every((p) => p.coverage === 0)).toBe(true)
    }
    expect(
      intervalRadius('overconfident', 'A', 0.7) / intervalRadius('overconfident', 'B', 0.7),
    ).toBeCloseTo(0.35)
  })
  it('represents missing evaluation groups as unavailable, rather than zero coverage', () => {
    const series = calibrationSeries('equipment', 'A', [], 'all')
    expect(series.every((s) => s.count === 0 && s.points.every((p) => p.coverage === null))).toBe(
      true,
    )
  })
})
