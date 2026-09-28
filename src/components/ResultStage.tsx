import { useEffect, useMemo, useState } from 'react'
import type { MatchRecord, Standing } from '../lib/decide'
import {
  formatPercent,
  formatRecord,
  headToHeadLabel,
  judgeVerdict,
} from '../lib/decide'
import { buildShareText, copyText } from '../lib/share'

interface Props {
  title: string
  standings: Standing[]
  records: MatchRecord[]
  reduced: boolean
  onRestart: () => void
  onNewQuestion: () => void
  onOpenProcess: () => void
  onResolved: (resolution: 'confirmed' | 'overridden', winnerLabel: string) => void
  onOpenHistory: () => void
}

type Phase = 'asking' | 'switching' | 'done'
type CopyState = 'idle' | 'ok' | 'fail'

const REVEAL_MS = 620

export default function ResultStage({
  title,
  standings,
  records,
  reduced,
  onRestart,
  onNewQuestion,
  onOpenProcess,
  onResolved,
  onOpenHistory,
}: Props) {
  const [revealed, setRevealed] = useState(reduced)
  const [phase, setPhase] = useState<Phase>('asking')
  const [finalLabel, setFinalLabel] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    if (reduced) return
    const t = window.setTimeout(() => setRevealed(true), REVEAL_MS)
    return () => window.clearTimeout(t)
  }, [reduced])

  const winner = standings[0]
  const runnerUp = standings[1]
  const verdict = useMemo(() => judgeVerdict(standings, records), [standings, records])
  const h2h = useMemo(() => headToHeadLabel(standings, records), [standings, records])

  const resolvedLabel = finalLabel ?? winner.candidate.label

  const sharePayload = useMemo(() => {
    return buildShareText({
      title: title.trim() || '这件事',
      winner: resolvedLabel,
      standings: standings.map((s) => ({
        label: s.candidate.label,
        wins: s.wins,
        played: s.played,
      })),
    })
  }, [title, resolvedLabel, standings])

  const handleCopy = async () => {
    const ok = await copyText(sharePayload)
    setCopyState(ok ? 'ok' : 'fail')
    setShowFallback(!ok)
    window.setTimeout(() => setCopyState('idle'), 2000)
  }

  const confirmWinner = () => {
    setFinalLabel(winner.candidate.label)
    setPhase('done')
    onResolved('confirmed', winner.candidate.label)
  }

  const pickAlternative = (label: string) => {
    setFinalLabel(label)
    setPhase('done')
    onResolved('overridden', label)
  }

  const others = standings.slice(0, 4)

  return (
    <section className={`result ${revealed ? 'is-in' : 'is-revealing'}`}>
      <div className="result-hero">
        <div className="hero-meta">
          <span>{title.trim() || '未命名决定'}</span>
          <span className="dot-sep" />
          <span>
            {records.length} 场 PK · {standings.length} 个候选
          </span>
        </div>

        <p className="hero-kicker">就它了。</p>
        <h1 className="hero-winner">
          <span className="hero-winner-text">{resolvedLabel}</span>
        </h1>

        <div className="hero-chips">
          <span className="chip">{formatRecord(winner)}</span>
          <span className="chip">胜率 {formatPercent(winner.winRate)}</span>
          {h2h && <span className="chip chip-soft">{h2h}</span>}
        </div>

        <div className={`verdict v-${verdict.level}`}>
          <span className="verdict-label">{verdict.label}</span>
          <span className="verdict-note">{verdict.note}</span>
        </div>
      </div>

      <div className="result-cols">
        <div className="card rank-card">
          <h2 className="card-title">最终排名</h2>
          <ol className="rank-list">
            {standings.map((s, i) => {
              const isFinal = resolvedLabel === s.candidate.label
              return (
                <li
                  className={`rank-row ${i === 0 ? 'is-first' : ''} ${
                    isFinal && (phase === 'done' ? 'is-final' : '')
                  }`}
                  key={s.candidate.id}
                >
                  <span className="rank-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="rank-body">
                    <span className="rank-name">{s.candidate.label}</span>
                    <span className="rank-sub">
                      {s.played} 场 · {s.wins} 胜 {s.losses} 负
                      {s.ties ? ` ${s.ties} 平` : ''} · {s.points} 分
                    </span>
                  </span>
                  <span className="rank-dots" aria-hidden="true">
                    {Array.from({ length: Math.max(s.played, 1) }).map((_, k) => (
                      <i
                        key={k}
                        className={
                          k < s.wins ? 'd win' : k < s.wins + s.ties ? 'd tie' : 'd lose'
                        }
                      />
                    ))}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="card method-card">
          <h2 className="card-title">这次是怎么定的</h2>
          <ul className="method-list">
            <li>
              <b>{records.length} 场二选一。</b>
              你只做了「二选一」这一种动作，没有打分、没有权重。
            </li>
            <li>
              <b>胜 1 分 / 平 0.5 分 / 负 0 分。</b>
              先按总分排序。
            </li>
            <li>
              <b>同分怎么办？</b>
              依次看两人直接对话、对共同对手的表现、胜场数，最后按你的输入顺序定案。
            </li>
            <li>
              <b>全程确定性。</b>
              没有随机抽签，没有 AI 参与。同样的选择，永远得到同样的结果。
            </li>
          </ul>
          <p className="method-note dim">
            {runnerUp
              ? `第一名「${winner.candidate.label}」与第二名「${runnerUp.candidate.label}」相差 ${(
                  winner.points - runnerUp.points
                ).toFixed(1)} 分。`
              : ''}
          </p>
        </div>
      </div>

      {phase === 'asking' && (
        <div className="regret">
          <p className="regret-q">看到这个结果，你第一反应是什么？</p>
          <div className="regret-btns">
            <button type="button" className="btn-solid" onClick={confirmWinner}>
              就它了
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setPhase('switching')}
            >
              等等，我好像更想选别的
            </button>
          </div>
        </div>
      )}

      {phase === 'switching' && (
        <div className="regret is-open">
          <p className="regret-quote">这也算一个答案。</p>
          <p className="regret-lede">
            有时候看到结果后想反悔，说明你真正想选的东西已经出现了。
          </p>
          <ul className="pick-list">
            {others.map((s, i) => (
              <li key={s.candidate.id}>
                <span className="pick-name">
                  <span className="pick-rank">{i + 1}</span>
                  {s.candidate.label}
                </span>
                <button
                  type="button"
                  className="pick-btn"
                  onClick={() => pickAlternative(s.candidate.label)}
                >
                  其实我想选它
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase === 'done' && (
        <div className="done">
          <p className="done-stamp">拍板</p>
          <h2 className="done-title">拍板。别再想了。</h2>
          <p className="done-line">
            {finalLabel === winner.candidate.label ? (
              <>
                <span className="dim">决定：</span>
                <b>{resolvedLabel}</b>
              </>
            ) : (
              <>
                <span className="dim">你改选了：</span>
                <b>{resolvedLabel}</b>
                <span className="dim"> —— 反悔也是答案。</span>
              </>
            )}
          </p>
        </div>
      )}

      <div className="action-row">
        <button type="button" className="btn-solid btn-sm" onClick={onRestart}>
          再来一次
        </button>
        <button type="button" className="btn-outline btn-sm" onClick={onNewQuestion}>
          换个问题
        </button>
        <button type="button" className="btn-outline btn-sm" onClick={onOpenProcess}>
          查看过程
        </button>
        <button type="button" className="btn-outline btn-sm" onClick={handleCopy}>
          {copyState === 'ok' ? '已复制 ✓' : copyState === 'fail' ? '复制失败' : '复制结果'}
        </button>
        <button type="button" className="btn-quiet btn-sm" onClick={onOpenHistory}>
          历史
        </button>
      </div>

      {showFallback && (
        <div className="copy-fallback">
          <p className="dim">浏览器拦下了自动复制，手动选中下面内容即可：</p>
          <textarea readOnly value={sharePayload} rows={5} />
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => setShowFallback(false)}
          >
            收起
          </button>
        </div>
      )}
    </section>
  )
}
