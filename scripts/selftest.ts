import { planSchedule, computeStandings, judgeVerdict, type Candidate, type MatchRecord, type Pair } from '../src/lib/decide'

function mk(n: number): Candidate[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    label: `选项${i + 1}`,
    seed: i,
  }))
}

/** 模拟一轮完整 PK：永远让「字典序靠前」的一方胜出 */
function run(cands: Candidate[], alwaysTie = false) {
  const records: MatchRecord[] = []
  let guard = 0
  const seen: Pair[] = []
  while (guard++ < 200) {
    const plan = planSchedule(cands, records)
    if (!plan.next) break
    seen.push(plan.next)
    const choice = alwaysTie ? 'tie' : plan.next.a < plan.next.b ? 'a' : 'b'
    records.push({ a: plan.next.a, b: plan.next.b, choice })
  }
  return { records, seen }
}

function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`)
  if (!cond) process.exitCode = 1
}

// 1. 场次数正确性
const expectCount: Record<number, number> = { 2: 1, 3: 3, 4: 6, 5: 10, 6: 15 }
for (const n of [2, 3, 4, 5, 6]) {
  const { records, seen } = run(mk(n))
  check(`${n} 候选 = ${expectCount[n]} 场`, records.length === expectCount[n], `实际 ${records.length}`)
  const uniq = new Set(seen.map((p) => (p.a < p.b ? p.a + p.b : p.b + p.a)))
  check(`${n} 候选无重复对阵`, uniq.size === records.length)
}

for (const n of [7, 8]) {
  const { records } = run(mk(n))
  check(`${n} 候选总场次 < ${(n * (n - 1)) / 2}`, records.length < (n * (n - 1)) / 2, `实际 ${records.length}`)
  check(`${n} 候选至少每人出场 2 次`, mk(n).every((c) => records.filter((r) => r.a === c.id || r.b === c.id).length >= 2))
}

// 2. 确定性：同样输入两次结果完全一致
for (const n of [3, 5, 7, 8]) {
  const a = run(mk(n))
  const b = run(mk(n))
  check(`${n} 候选赛程可复现`, JSON.stringify(a.seen) === JSON.stringify(b.seen))
}

// 3. 排序正确性：强者（seed 0 永远赢）
{
  const cands = mk(5)
  const { records } = run(cands)
  const st = computeStandings(cands, records)
  check('最强者排第一', st[0].candidate.id === 'c0', st.map((s) => s.candidate.label).join(','))
  check('第一名全胜', st[0].wins === 4 && st[0].points === 4, `${st[0].wins}胜 ${st[0].points}分`)
}

// 4. 全平局：走稳定 tie-break，按原始顺序
{
  const cands = mk(4)
  const { records } = run(cands, true)
  const st = computeStandings(cands, records)
  check('全平局按输入顺序定案', st.map((s) => s.candidate.id).join(',') === 'c0,c1,c2,c3', st.map((s) => s.candidate.id).join(','))
  const v = judgeVerdict(st, records)
  check('全平局判定为「几乎打平」', v.level === 'photo', v.label)
}

// 5. 循环克制（石头剪刀布）：应触发「对共同对手」/胜场/输入顺序 tie-break，不崩溃
{
  const cands = mk(3)
  const records: MatchRecord[] = [
    { a: 'c0', b: 'c1', choice: 'a' },
    { a: 'c1', b: 'c2', choice: 'a' },
    { a: 'c2', b: 'c0', choice: 'a' },
  ]
  const st = computeStandings(cands, records)
  check('循环克制：三者同积 1 分', st.every((s) => s.points === 1), st.map((s) => s.points).join('/'))
  check('循环克制：排序稳定有限', st.length === 3 && st[0].candidate.id === 'c0', st.map((s) => s.candidate.id).join(','))
}

// 6. 2 个候选的特殊情形
{
  const cands = mk(2)
  const { records } = run(cands)
  const st = computeStandings(cands, records)
  check('2 个候选：c0 胜出', st[0].candidate.id === 'c0' && st[0].played === 1)
}

console.log(process.exitCode ? '\n有测试未通过' : '\n全部通过')
