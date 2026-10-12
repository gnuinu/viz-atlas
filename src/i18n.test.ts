import { describe, expect, it } from 'vitest'
import { languageSearch, translate } from './i18n'
import { english } from './translations'
import { scenarios } from './data'

describe('English translations', () => {
  it('translates all scenario content and has no untranslated Korean in English messages', () => {
    for (const scenario of scenarios) {
      for (const field of ['name', 'title', 'description', 'takeaway'] as const) {
        expect(english[scenario[field]]).toBeTruthy()
      }
    }
    for (const [key, value] of Object.entries(english)) {
      expect(value).not.toMatch(/[가-힣]/)
      expect(value.match(/\{\d+\}/g)?.sort() ?? []).toEqual(key.match(/\{\d+\}/g)?.sort() ?? [])
    }
  })
  it('interpolates counts and keeps Korean available using the same placeholders', () => {
    expect(translate('en', '모델 {0}', 'B')).toBe('Model B')
    expect(translate('ko', '{0}개 샘플의 CSV를 내려받았습니다.', 0)).toBe(
      '0개 샘플의 CSV를 내려받았습니다.',
    )
    expect(translate('en', '{0}개 샘플의 CSV를 내려받았습니다.', 0)).toBe(
      'Downloaded a CSV with 0 samples.',
    )
    expect(translate('en', 'EQ-03')).toBe('EQ-03')
  })
  it('preserves analysis conditions while replacing the URL language', () => {
    const result = new URLSearchParams(languageSearch('scenario=drift&machine=EQ-03&lang=ko', 'en'))
    expect(result.get('lang')).toBe('en')
    expect(result.get('scenario')).toBe('drift')
    expect(result.get('machine')).toBe('EQ-03')
    expect(result.getAll('lang')).toEqual(['en'])
  })
})
