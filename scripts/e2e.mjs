/**
 * 端到端冒烟测试：走完「输入 → PK → 结果 → 反悔 → 完成」全流程，
 * 并检查刷新恢复、URL 复现、剪贴板分享、历史记录与移动端。
 *
 * 前置：先构建并起本地静态服务
 *   npm run build && npx vite preview --port 4173 --host 127.0.0.1
 *
 * 运行：
 *   npm i -D playwright-core
 *   BROWSER_PATH=<本机 Chrome / Edge 可执行文件> BASE_URL=http://127.0.0.1:4173/ node scripts/e2e.mjs
 */

import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/'
const OUT = 'screenshots/e2e'
const BROWSER = process.env.BROWSER_PATH

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  ...(BROWSER ? { executablePath: BROWSER } : {}),
  headless: true,
})

const errors = []
function watch(page, tag) {
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${tag}] ${m.text()}`)
  })
}

/** 把当前 PK 一路打完 */
async function playThrough(page, pickSide) {
  await page.bringToFront()
  for (let i = 0; i < 60; i++) {
    if (!(await page.locator('.arena').count())) break
    await pickSide(page, i)
    await wait(300)
    if (await page.locator('.result').count()) break
  }
  await wait(1300)
}

/* ---------------- 桌面：完整闭环 ---------------- */
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'zh-CN',
})
const page = await ctx.newPage()
watch(page, 'desktop')

await page.goto(BASE, { waitUntil: 'networkidle' })
await wait(400)
await page.screenshot({ path: `${OUT}/01-home.png` })

await page.getByRole('button', { name: '试试示例' }).click()
await wait(300)
await page.getByRole('button', { name: /开始 PK/ }).click()
await wait(400)
await page.screenshot({ path: `${OUT}/02-pk.png` })

await playThrough(page, async (p, i) => {
  if (i % 4 === 3) await p.locator('.tie-btn').click()
  else await p.locator('.fighter.side-a').click()
})
await page.screenshot({ path: `${OUT}/03-result.png` })

await page.getByRole('button', { name: /我好像更想选别的/ }).click()
await wait(400)
await page.screenshot({ path: `${OUT}/04-regret.png` })

await page.locator('.pick-btn').nth(2).click()
await wait(700)
await page.screenshot({ path: `${OUT}/05-done.png` })

await page.getByRole('button', { name: '查看过程' }).click()
await wait(400)
await page.screenshot({ path: `${OUT}/06-process.png` })
await page.locator('.icon-btn').first().click()
await wait(300)

await page.locator('.action-row').getByRole('button', { name: '历史' }).click()
await wait(400)
await page.screenshot({ path: `${OUT}/07-history.png` })
await page.locator('.overlay-backdrop').first().click()
await wait(300)

/* ---------------- 刷新恢复 + URL 复现 ---------------- */
await page.getByRole('button', { name: '再来一次' }).click()
await wait(400)
await page.keyboard.press('ArrowLeft')
await wait(320)
await page.reload({ waitUntil: 'networkidle' })
await wait(700)
const resumed = await page.locator('.pk-count-num').textContent()
console.log('刷新后恢复到第', resumed, '场')

const shareUrl = page.url()
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const p2 = await ctx2.newPage()
watch(p2, 'shared')
await p2.goto(shareUrl, { waitUntil: 'networkidle' })
await wait(500)
const filled = await p2
  .locator('.candidate-input')
  .evaluateAll((els) => els.map((e) => e.value).filter(Boolean))
console.log('分享链接还原候选:', filled.join(' / ') || '(空)')

/* ---------------- 剪贴板分享 ---------------- */
await p2.getByRole('button', { name: /开始 PK/ }).click()
await wait(400)
await playThrough(p2, async (p) => p.locator('.fighter.side-b').click())
console.log('分享页到达结果:', (await p2.locator('.result').count()) ? 'YES' : 'NO')
await p2.getByRole('button', { name: '就它了' }).click()
await wait(300)
await p2.getByRole('button', { name: '复制结果' }).click()
await wait(300)
console.log('复制按钮反馈:', await p2.locator('.action-row button', { hasText: '已复制' }).count() ? '已复制' : '无')

/* ---------------- 移动端 ---------------- */
const mob = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
})
const mp = await mob.newPage()
watch(mp, 'mobile')
await mp.goto(BASE, { waitUntil: 'networkidle' })
await wait(400)
await mp.screenshot({ path: `${OUT}/08-mobile-home.png` })
await mp.getByRole('button', { name: '试试示例' }).click()
await mp.getByRole('button', { name: /开始 PK/ }).click()
await wait(400)
await mp.screenshot({ path: `${OUT}/09-mobile-pk.png` })
await playThrough(mp, async (p) => p.locator('.fighter.side-a').click())
await mp.screenshot({ path: `${OUT}/10-mobile-result.png`, fullPage: true })

console.log('页面错误:', errors.length ? errors : 'none')
await browser.close()
if (errors.length) process.exitCode = 1
