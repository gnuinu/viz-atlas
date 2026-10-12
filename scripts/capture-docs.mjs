import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

// Use the deployed demo by default, or pass a local preview URL as the first argument.
const baseUrl = process.argv[2] ?? 'https://gnuinu.github.io/viz-atlas/'
const output = new URL('../docs/images/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch(process.env.PW_CHROME ? { channel: 'chrome' } : {})
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1440 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const capture = async (
    name,
    query = '',
    { dark = false, selector, fullPage = false, language = 'ko' } = {},
  ) => {
    await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' })
    const url = new URL(query, baseUrl)
    url.searchParams.set('lang', language)
    await page.goto(url.href)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(page.locator('html')).toHaveAttribute('data-theme', dark ? 'dark' : 'light')
    await expect(page.locator('main h1')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await page
      .locator('img')
      .evaluateAll((images) => Promise.all(images.map((image) => image.decode())))
    const target = selector ? page.locator(selector) : page
    await target.screenshot({
      path: fileURLToPath(new URL(`${name}.png`, output)),
      animations: 'disabled',
      ...(selector ? {} : { fullPage }),
    })
    console.log(`Captured ${name}.png`)
  }
  await capture('prediction-lab', '?scenario=equipment&view=diagnostics')
  await capture('conditional-comparison', '?scenario=equipment&view=comparison', {
    fullPage: true,
  })
  await capture('interval-calibration', '?scenario=overconfident&view=uncertainty', {
    selector: '.calibration-card',
  })
  await capture('visualization-library', '#patterns', { fullPage: true })
  await capture('dark-mode', '?scenario=equipment&view=diagnostics', { dark: true })
  await capture('prediction-lab-en', '?scenario=equipment&view=diagnostics', { language: 'en' })
  await page.setViewportSize({ width: 390, height: 1800 })
  await capture('mobile', '?scenario=equipment&view=diagnostics')
  await capture('mobile-en', '?scenario=equipment&view=diagnostics', { language: 'en' })
  if (errors.length) throw new Error(errors.join('\n'))
} finally {
  await browser.close()
}
