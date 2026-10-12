import { describe, expect, it } from 'vitest'
import {
  boxStats,
  conformalQuantile,
  createDataset,
  defaults,
  metrics,
  parseSettings,
  scenarios,
  settingsSearch,
  toCSV,
} from './data'

describe('reproducible simulation', () => {
  it('uses identical actuals and sample identities across models and scenarios', () => {
    const reference = createDataset('balanced', 'A')
    for (const scenario of scenarios) {
      for (const model of ['A', 'B'] as const) {
        const data = createDataset(scenario.id, model)
        expect(data).toHaveLength(360)
        expect(data.map((d) => [d.id, d.actual, d.machine, d.date])).toEqual(
          reference.map((d) => [d.id, d.actual, d.machine, d.date]),
        )
        expect(data.every((d) => Number.isFinite(d.predicted) && d.lower < d.upper)).toBe(true)
      }
    }
    expect(createDataset('balanced', 'A')).toEqual(reference)
  })
  it('makes the equipment failure visible with positive residuals and an improved comparator', () => {
    const a = createDataset('equipment', 'A'),
      b = createDataset('equipment', 'B')
    const failing = metrics(
      a.filter((d) => d.machine === 'EQ-03'),
      5,
    )
    expect(failing.bias).toBeGreaterThan(4)
    expect(failing.mae).toBeGreaterThan(
      metrics(
        a.filter((d) => d.machine === 'EQ-01'),
        5,
      ).mae * 2,
    )
    expect(metrics(b, 5).mae).toBeLessThan(metrics(a, 5).mae)
  })
  it('isolates overconfidence from point forecast quality', () => {
    const a = createDataset('overconfident', 'A'),
      b = createDataset('overconfident', 'B')
    expect(a.map((d) => d.predicted)).toEqual(b.map((d) => d.predicted))
    expect(metrics(a, 5).coverage).toBeLessThan(60)
    expect(metrics(b, 5).coverage).toBeGreaterThan(80)
    expect(metrics(a, 5).width / metrics(b, 5).width).toBeCloseTo(0.35)
  })
  it('exhibits temporal degradation after the midpoint', () => {
    const d = createDataset('drift', 'A')
    expect(metrics(d.slice(240), 5).mae).toBeGreaterThan(metrics(d.slice(0, 120), 5).mae * 2)
  })
})
describe('statistics and exports', () => {
  it('computes known metrics with the actual-minus-predicted convention and inclusive tolerance', () => {
    const base = createDataset('balanced', 'A')[0]
    const data = [2, -4].map((residual) => ({
      ...base,
      actual: 10,
      predicted: 10 - residual,
      residual,
      absoluteError: Math.abs(residual),
      lower: 8,
      upper: 12,
    }))
    const m = metrics(data, 2)
    expect(m.mae).toBe(3)
    expect(m.rmse).toBeCloseTo(Math.sqrt(10))
    expect(m.bias).toBe(-1)
    expect(m.within).toBe(50)
    expect(m.coverage).toBe(100)
    expect(m.width).toBe(4)
  })
  it('uses the finite sample correction for conformal quantiles', () => {
    expect(conformalQuantile([9, 1, 8, 2, 7, 3, 6, 4, 5], 0.8)).toBe(8)
    expect(conformalQuantile([1, 2], 0.99)).toBe(Infinity)
    expect(() => conformalQuantile([])).toThrow()
  })
  it('calculates quartiles and whiskers excluding an outlier', () => {
    expect(boxStats([0, 1, 2, 3, 100])).toEqual({ q1: 1, median: 2, q3: 3, low: 0, high: 3 })
  })
  it('exports all filtered samples and enough metadata to reproduce a view', () => {
    const settings = { ...defaults, machine: 'EQ-03' as const }
    const data = createDataset(settings.scenario, settings.model).filter(
      (d) => d.machine === settings.machine,
    )
    const rows = toCSV(data, settings).split('\r\n')
    expect(rows).toHaveLength(121)
    expect(rows[0]).toContain('lower_90_nm')
    expect(rows[1]).toContain(',EQ-03,')
    expect(rows[1]).toContain(',5,equipment,A')
  })
  it('roundtrips settings and rejects invalid URL parameters', () => {
    expect(parseSettings(settingsSearch(defaults))).toEqual(defaults)
    expect(parseSettings('?scenario=bad&machine=bad&view=bad&tolerance=NaN')).toEqual(defaults)
    expect(parseSettings('?tolerance=999').tolerance).toBe(12)
    expect(parseSettings('?tolerance=-5').tolerance).toBe(1)
    expect(parseSettings('?tolerance=').tolerance).toBe(5)
  })
})
