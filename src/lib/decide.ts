/**
 * 拍板 · 决策算法（纯函数，零随机，零 AI）
 *
 * 全部逻辑在本地完成：
 *  - 赛程：完全由候选输入顺序推导，同样的输入永远得到同样的对阵顺序
 *  - 计分：胜 1 分 / 平 0.5 分 / 负 0 分
 *  - 排序：积分 → 直接对话 → 对共同对手表现 → 胜场数 → 原始输入顺序
 */

export interface Candidate {
  id: string
  label: string
  /** 原始输入顺序，作为最终稳定 tie-break，禁止随机 */
  seed: number
}

export type Choice = 'a' | 'b' | 'tie'

export interface MatchRecord {
  /** 左侧候选 id */
  a: string
  /** 右侧候选 id */
  b: string
  choice: Choice
}

export interface Pair {
  a: string
  b: string
}

export interface Standing {
  candidate: Candidate
  seed: number
  points: number
  wins: number
  losses: number
  ties: number
  played: number
  /** (胜场 + 0.5 * 平局) / 参赛场次，0 ~ 1 */
  winRate: number
}

export const MAX_CANDIDATES = 8
export const MIN_CANDIDATES = 2
export const MAX_LABEL_LENGTH = 40

/** 不超过该数量时做完整两两对决 */
const FULL_ROUND_ROBIN_LIMIT = 6

/* ------------------------------------------------------------------ */
/* 输入清洗                                                             */
/* ------------------------------------------------------------------ */

export function normalizeLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH)
}

export function isMeaningfulLabel(raw: string): boolean {
  return normalizeLabel(raw).length > 0
}

/* ------------------------------------------------------------------ */
/* 赛程生成                                                             */
/* ------------------------------------------------------------------ */

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function dedupePairs(pairs: Pair[]): Pair[] {
  const seen = new Set<string>()
  const out: Pair[] = []
  for (const p of pairs) {
    if (p.a === p.b) continue
    const k = pairKey(p.a, p.b)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(p)
  }
  return out
}

function totalRoundRobin(ids: string[]): Pair[] {
  const out: Pair[] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) out.push({ a: ids[i], b: ids[j] })
  }
  return out
}

/** 环形赛：每个候选恰好与左右邻居各比一场，奇数人数时每人恰好 2 场 */
function ringRound(ids: string[]): Pair[] {
  const n = ids.length
  const out: Pair[] = []
  for (let i = 0; i < n; i++) out.push({ a: ids[i], b: ids[(i + 1) % n] })
  return out
}

/** 循环赛编排（circle method）的前 N 轮：偶数人数时每人每轮出场一次 */
function circleRounds(ids: string[], rounds: number): Pair[] {
  const even = ids.length % 2 === 0
  const list = even ? [...ids] : [...ids, '__BYE__']
  const size = list.length
  const half = size / 2
  const result: Pair[] = []

  for (let r = 0; r < rounds; r++) {
    const roundPairs: Pair[] = []
    for (let i = 0; i < half; i++) {
      const left = list[i]
      const right = list[size - 1 - i]
      if (left === '__BYE__' || right === '__BYE__') continue
      roundPairs.push({ a: left, b: right })
    }
    if (r % 2 === 1) roundPairs.reverse()
    result.push(...roundPairs)
    // 固定首元素，其余右移一位
    const rest = list.slice(1)
    list.splice(0, size, list[0], rest[rest.length - 1], ...rest.slice(0, rest.length - 1))
  }
  return result
}

/**
 * 对阵顺序重排：优先让休息更久的候选出场，避免同一候选连续出现在相邻两场。
 * 贪心 + 固定 tie-break，结果完全确定、可复现。
 */
function balanceRotation(pairs: Pair[]): Pair[] {
  const pool = [...pairs]
  const out: Pair[] = []
  const lastStep = new Map<string, number>()

  for (let step = 0; pool.length > 0; step++) {
    let bestIdx = 0
    let bestRest = -Infinity
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i]
      const rest =
        step - (lastStep.get(p.a) ?? -1000) + (step - (lastStep.get(p.b) ?? -1000))
      if (rest > bestRest) {
        bestRest = rest
        bestIdx = i
      }
    }
    const chosen = pool.splice(bestIdx, 1)[0]
    out.push(chosen)
    lastStep.set(chosen.a, step)
    lastStep.set(chosen.b, step)
  }
  return out
}

function sortedIds(candidates: Candidate[]): string[] {
  return [...candidates].sort((x, y) => x.seed - y.seed).map((c) => c.id)
}

/** 是否为「快速赛制」（7 ~ 8 个候选） */
export function isQuickFormat(candidates: Candidate[]): boolean {
  return candidates.length > FULL_ROUND_ROBIN_LIMIT
}

/** 第一阶段赛程：保证每个候选至少出场 2 次 */
function phaseOnePairs(candidates: Candidate[]): Pair[] {
  const ids = sortedIds(candidates)
  const even = ids.length % 2 === 0
  const raw = even ? circleRounds(ids, 2) : ringRound(ids)
  return balanceRotation(dedupePairs(raw))
}

/** 第二阶段赛程：第一阶段结束后，按积分取前 3 做循环赛 */
function phaseTwoPairs(candidates: Candidate[], records: MatchRecord[]): Pair[] {
  const standings = computeStandings(candidates, records)
  const topIds = standings.slice(0, 3).map((s) => s.candidate.id)
  return dedupePairs(totalRoundRobin(topIds))
}

export interface SchedulePlan {
  /** 已确定的完整对阵序列 */
  pairs: Pair[]
  /** 下一场对阵（null 表示全部结束） */
  next: Pair | null
  /** 预计总场次 */
  total: number
  /** 已完成场次 */
  done: number
}

export function planSchedule(
  candidates: Candidate[],
  records: MatchRecord[],
): SchedulePlan {
  const played = new Set(records.map((r) => pairKey(r.a, r.b)))
  const isPlayed = (p: Pair) => played.has(pairKey(p.a, p.b))

  if (!isQuickFormat(candidates)) {
    const all = balanceRotation(dedupePairs(totalRoundRobin(sortedIds(candidates))))
    return {
      pairs: all,
      next: all.find((p) => !isPlayed(p)) ?? null,
      done: records.length,
      total: all.length,
    }
  }

  const phaseOne = phaseOnePairs(candidates)
  const pairs = phaseOne.some((p) => !isPlayed(p))
    ? phaseOne
    : [...phaseOne, ...phaseTwoPairs(candidates, records).filter((p) => !isPlayed(p))]

  const next = pairs.find((p) => !isPlayed(p)) ?? null
  return {
    pairs,
    next,
    done: records.length,
    total: pairs.length,
  }
}

/* ------------------------------------------------------------------ */
/* 计分与排序                                                           */
/* ------------------------------------------------------------------ */

export function pointsForChosen(isA: boolean, choice: Choice): number {
  if (choice === 'tie') return 0.5
  return (choice === 'a') === isA ? 1 : 0
}

export function winnerOf(record: MatchRecord): string | null {
  if (record.choice === 'tie') return null
  return record.choice === 'a' ? record.a : record.b
}

/** 归一化为「a 侧 = x」的对局视图 */
function headToHead(records: MatchRecord[], x: string, y: string): MatchRecord | null {
  for (const r of records) {
    if (r.a === x && r.b === y) return r
    if (r.a === y && r.b === x) {
      return {
        a: y,
        b: x,
        choice: r.choice === 'tie' ? 'tie' : r.choice === 'a' ? 'b' : 'a',
      }
    }
  }
  return null
}

export function computeStandings(
  candidates: Candidate[],
  records: MatchRecord[],
): Standing[] {
  const map = new Map<string, Standing>()
  const versus = new Map<string, Map<string, number>>()

  for (const c of candidates) {
    map.set(c.id, {
      candidate: c,
      seed: c.seed,
      points: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      played: 0,
      winRate: 0,
    })
    versus.set(c.id, new Map())
  }

  for (const r of records) {
    const sa = map.get(r.a)
    const sb = map.get(r.b)
    if (!sa || !sb) continue
    const pa = pointsForChosen(true, r.choice)
    const pb = pointsForChosen(false, r.choice)

    sa.points += pa
    sb.points += pb
    sa.played += 1
    sb.played += 1
    if (pa === 1) sa.wins += 1
    else if (pa === 0.5) sa.ties += 1
    else sa.losses += 1
    if (pb === 1) sb.wins += 1
    else if (pb === 0.5) sb.ties += 1
    else sb.losses += 1

    versus.get(r.a)!.set(r.b, pa)
    versus.get(r.b)!.set(r.a, pb)
  }

  const list = candidates.map((c) => {
    const s = map.get(c.id)!
    s.winRate = s.played === 0 ? 0 : (s.wins + s.ties * 0.5) / s.played
    return s
  })

  const compare = (x: Standing, y: Standing): number => {
    // 1. 总积分
    if (y.points !== x.points) return y.points - x.points

    // 2. 两者直接对决结果
    const h2h = headToHead(records, x.candidate.id, y.candidate.id)
    if (h2h && h2h.choice !== 'tie') {
      const xGot = pointsForChosen(true, h2h.choice)
      if (xGot === 1) return -1
      return 1
    }

    // 3. 对共同对手的表现
    const ox = versus.get(x.candidate.id)!
    const oy = versus.get(y.candidate.id)!
    let sx = 0
    let sy = 0
    ox.forEach((p, id) => {
      if (oy.has(id)) {
        sx += p
        sy += oy.get(id)!
      }
    })
    if (sx !== sy) return sy - sx

    // 4. 胜场数
    if (y.wins !== x.wins) return y.wins - x.wins

    // 5. 原始输入顺序（稳定，禁止随机）
    return x.seed - y.seed
  }

  list.sort(compare)
  return list
}

/* ------------------------------------------------------------------ */
/* 结果解读                                                             */
/* ------------------------------------------------------------------ */

export type VerdictLevel = 'clear' | 'solid' | 'narrow' | 'photo'

export interface Verdict {
  level: VerdictLevel
  label: string
  note: string
}

export function judgeVerdict(standings: Standing[], records: MatchRecord[]): Verdict {
  if (standings.length < 2) {
    return { level: 'clear', label: '唯一候选', note: '只有一个候选，不需要纠结。' }
  }
  const first = standings[0]
  const second = standings[1]
  const gap = first.points - second.points
  const scale = Math.max(first.played, second.played, 1)

  if (gap >= scale * 0.4) {
    return {
      level: 'clear',
      label: '明显领先',
      note: '几场 PK 下来几乎没有悬念，放心拍板。',
    }
  }
  if (gap >= 0.75) {
    return { level: 'solid', label: '稳稳胜出', note: '每一场都没掉链子，优势稳定。' }
  }
  if (gap > 0) {
    return {
      level: 'narrow',
      label: '险胜',
      note: '只领先一点点，但这正是此刻最真实的选择。',
    }
  }
  const h2h = headToHead(records, first.candidate.id, second.candidate.id)
  if (h2h && h2h.choice !== 'tie') {
    return {
      level: 'photo',
      label: '几乎打平',
      note: '积分咬得很紧，靠直接对话胜出，赢在关键一场。',
    }
  }
  return {
    level: 'photo',
    label: '几乎打平',
    note: '和第二名难分高下，最终按原始顺序定案。',
  }
}

export function headToHeadLabel(
  standings: Standing[],
  records: MatchRecord[],
): string | null {
  if (standings.length < 2) return null
  const first = standings[0]
  const second = standings[1]
  const h2h = headToHead(records, first.candidate.id, second.candidate.id)
  if (!h2h) return null
  const name = second.candidate.label
  if (h2h.choice === 'tie') return `与第二名「${name}」战平`
  const won = pointsForChosen(true, h2h.choice) === 1
  return won ? `直接战胜第二名「${name}」` : `输给第二名「${name}」，靠总战绩登顶`
}

export function formatRecord(standing: Standing): string {
  if (standing.played === 0) return '未出场'
  return `${standing.played} 场 PK · ${standing.wins} 胜 ${standing.losses} 负${
    standing.ties ? ` ${standing.ties} 平` : ''
  }`
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}
