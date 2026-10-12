import { test, expect } from '@playwright/test'

test('filters, models, tolerance and sample selection stay in sync', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Actual vs. Predicted.' })).toBeVisible()
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
  await expect(page.locator('.pattern-card')).toHaveCount(6)
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
  await expect(page.getByRole('heading', { name: '시각화 라이브러리.' })).toBeVisible()
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
  for (const tab of ['불확실성', '시간별 추이']) {
    await page.getByRole('tab', { name: tab }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(errors).toEqual([])
})
