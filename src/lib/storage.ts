/**
 * 本地历史记录存储封装。
 * localStorage 不可用 / 被禁用 / 写满时静默降级，绝不抛错中断主流程。
 */

import type { Choice } from './decide'

export interface HistoryRecord {
  /** 存标签而非 id，保证历史可读、可脱离当次会话独立查看 */
  a: string
  b: string
  choice: Choice
}

export interface HistoryStanding {
  label: string
  points: number
  wins: number
  losses: number
  ties: number
  played: number
}

export interface HistoryEntry {
  id: string
  createdAt: number
  title: string
  candidates: string[]
  winner: string
  /** 用户是否为反悔后手动改选 */
  resolution: 'confirmed' | 'overridden'
  standings: HistoryStanding[]
  records: HistoryRecord[]
}

const STORAGE_KEY = 'paiban.history.v1'
const MAX_ENTRIES = 20

let available = true

function safeStorage(): Storage | null {
  if (!available) return null
  try {
    const s = window.localStorage
    const probe = '__paiban_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    available = false
    return null
  }
}

export function isStorageAvailable(): boolean {
  return safeStorage() !== null
}

export function loadHistory(): HistoryEntry[] {
  const s = safeStorage()
  if (!s) return []
  try {
    const raw = s.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((e): e is HistoryEntry => !!e && typeof e.id === 'string')
  } catch {
    return []
  }
}

export function saveHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const s = safeStorage()
  if (!s) return []
  try {
    const list = loadHistory()
    const next = [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES)
    s.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  } catch {
    return loadHistory()
  }
}

export function clearHistory(): HistoryEntry[] {
  const s = safeStorage()
  if (!s) return []
  try {
    s.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  return []
}

let seq = 0
export function makeId(prefix = 'id'): string {
  seq += 1
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`
}

/* ------------------------------------------------------------------ */
/* 进行中的会话（sessionStorage）：刷新页面后不丢失当前 PK 进度            */
/* ------------------------------------------------------------------ */

const SESSION_KEY = 'paiban.session.v1'

export interface PersistedSession {
  title: string
  candidates: { id: string; label: string; seed: number }[]
  records: { a: string; b: string; choice: Choice }[]
  stage: 'setup' | 'pk' | 'result'
}

function safeSession(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function loadSession(): PersistedSession | null {
  const s = safeSession()
  if (!s) return null
  try {
    const raw = s.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.candidates) || !Array.isArray(parsed.records)) {
      return null
    }
    return parsed as PersistedSession
  } catch {
    return null
  }
}

export function saveSession(session: PersistedSession): void {
  const s = safeSession()
  if (!s) return
  try {
    s.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  const s = safeSession()
  if (!s) return
  try {
    s.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}
