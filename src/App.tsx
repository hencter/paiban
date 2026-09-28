import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SetupStage from './components/SetupStage'
import PkStage from './components/PkStage'
import ResultStage from './components/ResultStage'
import ProcessModal from './components/ProcessModal'
import HistoryPanel from './components/HistoryPanel'
import type { Candidate, Choice, MatchRecord } from './lib/decide'
import { computeStandings, planSchedule, normalizeLabel } from './lib/decide'
import { useReducedMotion } from './lib/useReducedMotion'
import {
  clearHistory,
  clearSession,
  loadHistory,
  loadSession,
  makeId,
  saveHistoryEntry,
  saveSession,
  type HistoryEntry,
} from './lib/storage'
import { readPayloadFromUrl, writePayloadToUrl } from './lib/share'

type Stage = 'setup' | 'pk' | 'result'

const SAMPLE = {
  title: '今晚吃什么',
  candidates: ['火锅', '日料', '烧烤', '汉堡', '在家煮'],
}

function toCandidates(labels: string[]): Candidate[] {
  return labels.map((label, i) => ({ id: makeId('c'), label, seed: i }))
}

export default function App() {
  const reduced = useReducedMotion()
  const [stage, setStage] = useState<Stage>('setup')
  const [title, setTitle] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [records, setRecords] = useState<MatchRecord[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [processOpen, setProcessOpen] = useState(false)
  const [restored, setRestored] = useState(false)
  /** 递增以重建输入页内部状态（示例填充 / 换个问题） */
  const [setupRev, setSetupRev] = useState(0)
  /** 初始化完成前不渲染输入页，保证候选/标题正确注入 */
  const [ready, setReady] = useState(false)

  const sessionIdRef = useRef<string>('s_0')
  const savedRef = useRef<boolean>(false)

  // 初始化：优先恢复本页进行中的进度 → 其次 URL 复现参数 → 历史
  useEffect(() => {
    setHistory(loadHistory())

    const session = loadSession()
    if (session && session.candidates.length >= 2) {
      setTitle(session.title)
      setCandidates(session.candidates)
      setRecords(session.records)
      setStage(session.stage === 'setup' ? 'setup' : session.stage)
      if (session.stage !== 'setup') setRestored(true)
      return
    }

    const shared = readPayloadFromUrl()
    if (shared) {
      setTitle(shared.title)
      setCandidates(toCandidates(shared.candidates))
    }
    setReady(true)
  }, [])

  // 持久化进度
  useEffect(() => {
    if (candidates.length === 0) return
    if (stage === 'setup' && records.length === 0) {
      clearSession()
      return
    }
    saveSession({ title, candidates, records, stage })
  }, [title, candidates, records, stage])

  const standings = useMemo(
    () => (candidates.length ? computeStandings(candidates, records) : []),
    [candidates, records],
  )

  const saveDecision = useCallback(
    (resolution: 'confirmed' | 'overridden', winnerLabel: string) => {
      if (savedRef.current) return
      savedRef.current = true
      const entry: HistoryEntry = {
        id: sessionIdRef.current,
        createdAt: Date.now(),
        title: title.trim() || '未命名决定',
        candidates: candidates.map((c) => c.label),
        winner: winnerLabel,
        resolution,
        standings: standings.map((s) => ({
          label: s.candidate.label,
          points: s.points,
          wins: s.wins,
          losses: s.losses,
          ties: s.ties,
          played: s.played,
        })),
        records: records.map((r) => ({
          a: candidates.find((c) => c.id === r.a)?.label ?? '?',
          b: candidates.find((c) => c.id === r.b)?.label ?? '?',
          choice: r.choice,
        })),
      }
      setHistory(saveHistoryEntry(entry))
    },
    [candidates, records, standings, title],
  )

  const startPk = useCallback(
    (nextTitle: string, labels: string[]) => {
      const clean = labels.map(normalizeLabel).filter(Boolean)
      if (clean.length < 2) return
      sessionIdRef.current = makeId('s')
      savedRef.current = false
      setTitle(nextTitle)
      setCandidates(toCandidates(clean))
      setRecords([])
      setStage('pk')
      writePayloadToUrl({ title: nextTitle, candidates: clean })
    },
    [],
  )

  const handleChoice = useCallback(
    (pair: { a: string; b: string }, choice: Choice) => {
      setRecords((prev) => {
        const next = [...prev, { a: pair.a, b: pair.b, choice }]
        return next
      })
    },
    [],
  )

  // 全部 PK 结束后进入结果页
  useEffect(() => {
    if (stage !== 'pk' || candidates.length < 2) return
    const plan = planSchedule(candidates, records)
    if (!plan.next && records.length > 0) setStage('result')
  }, [stage, candidates, records])

  const backToSetup = useCallback(() => {
    setProcessOpen(false)
    setStage('setup')
    setRecords([])
  }, [])

  const restartSame = useCallback(() => {
    setProcessOpen(false)
    sessionIdRef.current = makeId('s')
    savedRef.current = false
    setRecords([])
    setStage('pk')
  }, [])

  const newQuestion = useCallback(() => {
    setProcessOpen(false)
    clearSession()
    setStage('setup')
    setRecords([])
    setCandidates([])
    setTitle('')
    setRestored(false)
    setSetupRev((r) => r + 1)
    writePayloadToUrl(null)
  }, [])

  const useSample = useCallback(() => {
    setRestored(false)
    setTitle(SAMPLE.title)
    setCandidates(toCandidates(SAMPLE.candidates))
    setStage('setup')
    setSetupRev((r) => r + 1)
  }, [])

  const handleClearHistory = useCallback(() => {
    setHistory(clearHistory())
  }, [])

  const currentPlan = useMemo(
    () => (candidates.length >= 2 ? planSchedule(candidates, records) : null),
    [candidates, records],
  )

  const labelById = useMemo(() => {
    const m = new Map<string, string>()
    candidates.forEach((c) => m.set(c.id, c.label))
    return m
  }, [candidates])

  return (
    <div className={`app ${stage === 'pk' ? 'is-focus' : ''}`}>
      <header className="topbar">
        <button
          type="button"
          className="brand"
          onClick={() => {
            if (stage === 'pk') return
            newQuestion()
          }}
          aria-label="拍板 首页"
        >
          <span className="brand-mark">拍板</span>
          <span className="brand-sub">PAIBAN / DECIDE NOW</span>
        </button>

        {stage === 'pk' ? (
          <button type="button" className="ghost-btn" onClick={backToSetup}>
            ← 改选项
          </button>
        ) : (
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setHistoryOpen(true)}
            disabled={history.length === 0}
            title={history.length === 0 ? '还没有历史记录' : '查看历史'}
          >
            历史{history.length > 0 ? ` · ${history.length}` : ''}
          </button>
        )}
      </header>

      <main className="stage-wrap">
        {stage === 'setup' && ready && (
          <SetupStage
            key={setupRev}
            initialTitle={title}
            initialCandidates={candidates.map((c) => c.label)}
            onStart={startPk}
            onUseSample={useSample}
            restored={restored}
            onDismissRestored={() => setRestored(false)}
            onResume={() => {
              if (records.length > 0) setStage('pk')
              else setStage('setup')
            }}
          />
        )}

        {stage === 'pk' && currentPlan?.next && (
          <PkStage
            pair={currentPlan.next}
            done={currentPlan.done}
            total={currentPlan.total}
            labelA={labelById.get(currentPlan.next.a) ?? '—'}
            labelB={labelById.get(currentPlan.next.b) ?? '—'}
            onChoose={(choice) => handleChoice(currentPlan.next!, choice)}
            reduced={reduced}
          />
        )}

        {stage === 'result' && standings.length > 0 && (
          <ResultStage
            title={title}
            standings={standings}
            records={records}
            reduced={reduced}
            onRestart={restartSame}
            onNewQuestion={newQuestion}
            onOpenProcess={() => setProcessOpen(true)}
            onResolved={saveDecision}
            onOpenHistory={() => setHistoryOpen(true)}
          />
        )}
      </main>

      <footer className="footer">
        <span>不打分，不填表。一个个二选一，最后拍板。</span>
        <span className="footer-dim">数据只存在这台设备的浏览器里 · 无任何 AI 参与</span>
      </footer>

      {processOpen && (
        <ProcessModal
          candidates={candidates}
          records={records}
          onClose={() => setProcessOpen(false)}
        />
      )}

      {historyOpen && (
        <HistoryPanel
          entries={history}
          onClose={() => setHistoryOpen(false)}
          onClear={handleClearHistory}
        />
      )}
    </div>
  )
}
