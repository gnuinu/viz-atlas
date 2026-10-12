import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { english } from './translations'

export type Language = 'ko' | 'en'
const storageKey = 'viz-atlas-language'
function valid(value: string | null): value is Language {
  return value === 'ko' || value === 'en'
}
function storedLanguage(): Language {
  try {
    const saved = localStorage.getItem(storageKey)
    return valid(saved) ? saved : 'ko'
  } catch {
    return 'ko'
  }
}
function initialLanguage(): Language {
  const query = new URLSearchParams(location.search).get('lang')
  return valid(query) ? query : storedLanguage()
}
export function translate(language: Language, message: string, ...values: (string | number)[]) {
  const key = message.trim().replace(/\s+/g, ' ')
  const text = language === 'en' ? (english[key] ?? message) : message
  return text.replace(/\{(\d+)\}/g, (placeholder, index) =>
    String(values[Number(index)] ?? placeholder),
  )
}
export function languageSearch(search: string, language: Language) {
  const params = new URLSearchParams(search)
  params.set('lang', language)
  return params.toString()
}
const LanguageContext = createContext<{
  language: Language
  setLanguage: (language: Language) => void
  t: (message: string, ...values: (string | number)[]) => string
} | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(initialLanguage)
  const setLanguage = (next: Language) => {
    updateLanguage(next)
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // Language changes still work when browser storage is restricted.
    }
  }
  useLayoutEffect(() => {
    document.documentElement.lang = language
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        language === 'en'
          ? 'Viz Atlas — An interactive lab for actual vs. predicted values. Explore errors, uncertainty, and machine-level performance.'
          : 'Viz Atlas — 실제값과 예측값을 탐색하는 인터랙티브 데이터 시각화 실험실. 오차, 불확실성, 설비별 성능을 비교하세요.',
      )
  }, [language])
  useEffect(() => {
    const onPop = () => updateLanguage(initialLanguage())
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) updateLanguage(storedLanguage())
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (message: string, ...values: (string | number)[]) =>
        translate(language, message, ...values),
    }),
    [language],
  )
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
export function useTranslation() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useTranslation must be used within LanguageProvider')
  return value
}
