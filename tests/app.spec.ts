import { createDataset } from '../src/data'
import { filterObservations } from '../src/diagnostics'
import { test, expect } from '@playwright/test'

test('filters, models, tolerance and sample selection stay in sync', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: '예측 결과를 한눈에' })).toBeVisible()
  await expect(page.locator('.sample-count')).toHaveText('360 observations')
  const before = await page.getByTestId('within-value').textContent()
  await page.getByRole('button', { name: 'EQ-03', exact: true }).click()
  await expect(page.locator('.sample-count')).toHaveText('120 observations')
  expect(await page.getByTestId('within-value').textContent()).not.toBe(before)
  await page.getByRole('button', { name: '모델 B' }).click()
  await expect(page).toHaveURL(/model=B/)
  await page.getByRole('slider', { name: '허용 오차' }).fill('12')
  await expect(page.getByTestId('within-value')).toContainText('100.0')
  await page.getByRole('button', { name: '샘플 탐색' }).click()
  await page.locator('.sample-button').first().click()
  await expect(page.locator('.selection-strip')).toBeVisible()
  await expect(page.locator('.data-point.selected')).toHaveCount(2)
  await page.getByRole('button', { name: '초기화' }).click()
  await expect(page.locator('.sample-count')).toHaveText('360 observations')
})

test('uncertainty, time, library and guide views work with reloadable URLs', async ({ page }) => {
  await page.goto('./?scenario=overconfident&model=A&machine=전체&tolerance=5&view=uncertainty')
  await expect(page.getByText('이 구간은 의도적으로 좁힌 실패 사례입니다.')).toBeVisible()
  await page.getByRole('button', { name: '모델 B' }).click()
  await expect(page.getByText('이 구간은 합성 데이터의 split conformal 예제입니다.')).toBeVisible()
  await page.getByRole('tab', { name: '시간별 추이' }).click()
  await expect(page.getByRole('heading', { name: '성능 변화 추적' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('tab', { name: '시간별 추이' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('link', { name: '시각화 라이브러리' }).click()
  await expect(page.locator('.pattern-card')).toHaveCount(9)
  await page.getByRole('button', { name: /Prediction Intervals/ }).click()
  await expect(page.getByRole('tab', { name: '불확실성' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('link', { name: '읽는 법 & 노트' }).click()
  await expect(page.getByRole('heading', { name: '이 예제의 데이터와 계산' })).toBeVisible()
})

test('CSV exports the filtered data', async ({ page }) => {
  await page.goto('./?machine=EQ-02')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV 내보내기' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('viz-atlas-equipment-model-A-EQ-02.csv')
  const stream = await download.createReadStream()
  let text = ''
  for await (const chunk of stream!) text += chunk.toString()
  expect(text.split('\r\n')).toHaveLength(121)
})

test('mobile layout fits and navigation is operable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('./')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '메뉴 열기' }).click()
  await page.getByRole('link', { name: '시각화 라이브러리' }).click()
  await expect(page.getByRole('heading', { name: '좋은 질문에, 알맞은 차트' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('all scenarios render without runtime errors on narrow screens', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('./')
  for (const scenario of ['balanced', 'bias', 'hetero', 'equipment', 'drift', 'overconfident']) {
    await page.getByRole('combobox', { name: '시나리오' }).selectOption(scenario)
    await expect(page.locator('.data-point')).toHaveCount(720)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  for (const tab of ['조건별 비교', '불확실성', '시간별 추이']) {
    await page.getByRole('tab', { name: tab }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(errors).toEqual([])
})

test('heatmap selection links paired samples, URL, other charts and CSV', async ({ page }) => {
  await page.goto('./?view=comparison')
  await expect(page.locator('.heat-cell')).toHaveCount(18)
  const cell = page.getByRole('button', { name: /^EQ-03, 70-80 nm/ })
  await cell.click()
  await expect(cell).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/band=70-80/)
  const count = Number((await page.locator('.sample-count').innerText()).split(' ')[0])
  expect(count).toBeGreaterThan(0)
  expect(count).toBeLessThan(36)
  await expect(page.locator('.pair-point')).toHaveCount(count)
  await page.locator('.paired-table .sample-button').first().click()
  await expect(page.locator('.pair-point.selected')).toHaveCount(1)
  await expect(page.locator('.selection-strip')).toBeVisible()
  await page.getByRole('button', { name: '평균 잔차', exact: true }).click()
  await page.reload()
  await expect(cell).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '평균 잔차', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV 내보내기' }).click()
  const stream = await (await pending).createReadStream()
  let csv = ''
  for await (const chunk of stream!) csv += chunk.toString()
  const rows = csv.split('\r\n')
  expect(rows).toHaveLength(count + 1)
  expect(rows.slice(1).every((row) => row.includes(',EQ-03,') && row.endsWith(',70-80'))).toBe(true)
  await page.getByRole('tab', { name: '정확도 진단' }).click()
  await expect(page.locator('.data-point')).toHaveCount(count * 2)
  await page.getByRole('tab', { name: '불확실성' }).click()
  await expect(page.locator('.interval')).toHaveCount(count)
  await page.getByRole('tab', { name: '조건별 비교' }).click()
  await cell.click()
  await expect(page.locator('.sample-count')).toHaveText('360 observations')
})

test('calibration separates interval reliability from point accuracy', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./?scenario=overconfident&view=uncertainty')
  await expect(page.locator('.calibration-series')).toHaveCount(4)
  await expect(page.locator('.calibration-table tbody tr')).toHaveCount(5)
  const coverageA = Number(
    await page.locator('.calibration-table tbody tr').nth(3).locator('td').first().innerText(),
  )
  await page.getByRole('button', { name: '모델 B' }).click()
  const coverageB = Number(
    await page.locator('.calibration-table tbody tr').nth(3).locator('td').first().innerText(),
  )
  expect(coverageB).toBeGreaterThan(coverageA + 20)
  await page.getByRole('tab', { name: '조건별 비교' }).click()
  await expect(page.locator('.pair-point.tied')).toHaveCount(360)
  await expect(page.locator('.delta-total strong')).toHaveText('0.00')
  expect(errors).toEqual([])
})

test('conditional views remain usable at 320px with a narrow evaluation slice', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('./?machine=EQ-02&band=40-50&view=comparison')
  for (const tab of ['조건별 비교', '불확실성', '시간별 추이', '정확도 진단']) {
    await page.getByRole('tab', { name: tab }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const invalid = await page
      .locator('svg')
      .evaluateAll((svgs) => svgs.some((svg) => /(?:NaN|Infinity)/.test(svg.innerHTML)))
    expect(invalid).toBe(false)
  }
  expect(errors).toEqual([])
})

test('sparse time slices preserve actual dates and both series without bridging missing days', async ({
  page,
}) => {
  const subset = filterObservations(createDataset('equipment', 'A'), 'EQ-02', '40-50')
  const days = [...new Set(subset.map((d) => Number(d.date.slice(-2))))].sort((a, b) => a - b)
  await page.goto('./?machine=EQ-02&band=40-50&view=time')
  for (const series of ['actual', 'predicted']) {
    const shown = await page
      .locator(`[data-series="${series}"]`)
      .evaluateAll((points) => points.map((point) => Number(point.getAttribute('data-day'))))
    expect(shown).toEqual(days)
  }
  const expectedSegments = days.filter(
    (day, index) => index === 0 || day !== days[index - 1] + 1,
  ).length
  for (const path of await page
    .locator('.time-line')
    .evaluateAll((paths) => paths.map((path) => path.getAttribute('d')!))) {
    expect(path.match(/M/g)).toHaveLength(expectedSegments)
  }
})

test('theme toggle supports keyboard, reloads, and cross-tab sync without changing analysis', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('./?machine=EQ-03&band=70-80&view=comparison')
  const toggle = page.getByRole('switch', { name: '다크 모드' })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  const url = page.url()
  await toggle.focus()
  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.control-panel')).toHaveCSS('background-color', 'rgb(25, 31, 40)')
  await expect(page.locator('.sample-count')).toHaveText('23 observations')
  await expect(page).toHaveURL(url)
  await page.reload()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: /^EQ-03, 70-80 nm/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const other = await context.newPage()
  await other.goto('./')
  await expect(other.getByRole('switch', { name: '다크 모드' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await other.getByRole('switch', { name: '다크 모드' }).click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await other.close()
})

test('system appearance is followed until an explicit theme is chosen', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('./')
  const toggle = page.getByRole('switch', { name: '다크 모드' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await page.reload()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101318')
  await page.getByRole('link', { name: '읽는 법 & 노트' }).click()
  await expect(page.getByRole('heading', { name: '예측 결과를 설명하는 순서' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('고객')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.guide-article')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})

test('theme can change when browser storage is unavailable, including on mobile', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage blocked')
    }
    Storage.prototype.setItem = () => {
      throw new Error('Storage blocked')
    }
  })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('./')
  const toggle = page.getByRole('switch', { name: '다크 모드' })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  for (const tab of ['조건별 비교', '불확실성', '시간별 추이', '정확도 진단']) {
    await page.getByRole('tab', { name: tab }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(errors).toEqual([])
})

test('stored appearance is applied before the React bundle loads', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => localStorage.setItem('viz-atlas-theme', 'dark'))
  await page.route('**/assets/*.js', (route) => route.abort())
  await page.goto('./')
  await expect(page.locator('#root')).toBeEmpty()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(16, 19, 24)')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101318')
})
