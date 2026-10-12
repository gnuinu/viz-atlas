import { useEffect, useLayoutEffect, useState } from 'react'

type Theme = 'light' | 'dark'
// Keep this key in sync with the pre-paint initialization in index.html.
const storageKey = 'viz-atlas-theme'
const systemQuery = '(prefers-color-scheme: dark)'

function readPreference(): Theme | null {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

export function useTheme() {
  const [preference, setPreference] = useState<Theme | null>(readPreference)
  const [systemDark, setSystemDark] = useState(() => matchMedia(systemQuery).matches)
  const theme = preference ?? (systemDark ? 'dark' : 'light')

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#101318' : '#f2f4f6')
  }, [theme])

  useEffect(() => {
    const media = matchMedia(systemQuery)
    const onSystemChange = () => setSystemDark(media.matches)
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setPreference(readPreference())
    }
    onSystemChange()
    media.addEventListener('change', onSystemChange)
    window.addEventListener('storage', onStorageChange)
    return () => {
      media.removeEventListener('change', onSystemChange)
      window.removeEventListener('storage', onStorageChange)
    }
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setPreference(next)
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // Restricted storage must not prevent changing the current appearance.
    }
  }
  return { theme, toggleTheme }
}
