/** 复制分享：优先 Clipboard API，失败时降级到 textarea + execCommand */

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 继续走降级方案 */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, ta.value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

const MEDALS = ['🥇', '🥈', '🥉']

export function buildShareText(params: {
  title: string
  winner: string
  standings: { label: string; wins: number; played: number }[]
}): string {
  const { title, winner, standings } = params
  const lines: string[] = []
  lines.push(`我刚用「拍板」决定了${title}：`)
  standings.slice(0, 3).forEach((s, i) => {
    lines.push(`${MEDALS[i] ?? `${i + 1}.`} ${s.label}`)
  })
  const top = standings[0]
  if (top) lines.push(`${top.played} 场 PK，${winner}赢了 ${top.wins} 场。`)
  lines.push('—— 不打分，只 PK。')
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* URL 复现（增强项）：把候选题目与候选写进地址栏                        */
/* ------------------------------------------------------------------ */

function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromUrlSafe(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  return b64 + pad
}

export interface SharedPayload {
  title: string
  candidates: string[]
}

export function encodePayload(payload: SharedPayload): string {
  try {
    const json = JSON.stringify(payload)
    const bytes = new TextEncoder().encode(json)
    let bin = ''
    bytes.forEach((b) => {
      bin += String.fromCharCode(b)
    })
    return toUrlSafe(window.btoa(bin))
  } catch {
    return ''
  }
}

export function decodePayload(code: string): SharedPayload | null {
  try {
    const bin = window.atob(fromUrlSafe(code))
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return null
    const title = typeof parsed.title === 'string' ? parsed.title : ''
    const candidates = Array.isArray(parsed.candidates)
      ? parsed.candidates.filter((c: unknown): c is string => typeof c === 'string')
      : []
    if (candidates.length < 2) return null
    return { title, candidates: candidates.slice(0, 8) }
  } catch {
    return null
  }
}

export function writePayloadToUrl(payload: SharedPayload | null): void {
  try {
    const url = new URL(window.location.href)
    if (payload) url.searchParams.set('q', encodePayload(payload))
    else url.searchParams.delete('q')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  } catch {
    /* 地址栏不可用时忽略 */
  }
}

export function readPayloadFromUrl(): SharedPayload | null {
  try {
    const code = new URL(window.location.href).searchParams.get('q')
    return code ? decodePayload(code) : null
  } catch {
    return null
  }
}
