import { useCallback, useEffect, useRef, useState } from 'react'
import type { Choice, Pair } from '../lib/decide'

interface Props {
  pair: Pair
  done: number
  total: number
  labelA: string
  labelB: string
  onChoose: (choice: Choice) => void
  reduced: boolean
}

const COMMIT_DELAY = 190

export default function PkStage({
  pair,
  done,
  total,
  labelA,
  labelB,
  onChoose,
  reduced,
}: Props) {
  const [picked, setPicked] = useState<Choice | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    setPicked(null)
    if (timerRef.current) window.clearTimeout(timerRef.current)
  }, [pair.a, pair.b])

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const pick = useCallback(
    (side: Choice) => {
      if (picked || !pair) return
      setPicked(side)
      const commit = () => onChoose(side)
      if (reduced) commit()
      else timerRef.current = window.setTimeout(commit, COMMIT_DELAY)
    },
    [picked, pair, onChoose, reduced],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        pick('a')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        pick('b')
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        pick('tie')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pick])

  const progress = Math.min(1, total > 0 ? done / total : 0)
  const roundLabel = `第 ${Math.min(done + 1, Math.max(total, 1))} 场`

  return (
    <section className="pk" aria-live="polite">
      <div className="pk-head">
        <div className="pk-round">
          <strong>{roundLabel}</strong>
          <span className="dim">
            {' '}
            / 共 {total} 场
          </span>
        </div>
        <div className="pk-count">
          <span className="pk-count-num">{done}</span>
          <span className="dim"> / {total}</span>
        </div>
      </div>

      <div className="pk-bar" role="progressbar" aria-valuenow={done} aria-valuemax={total}>
        <span className="pk-bar-fill" style={{ transform: `scaleX(${progress})` }} />
      </div>

      <h2 className="pk-question">如果现在只能留一个？</h2>

      <div className={`arena ${picked ? 'is-resolved' : ''}`} key={`${pair.a}${pair.b}`}>
        <button
          type="button"
          className={`fighter side-a ${picked === 'a' ? 'is-picked' : ''} ${
            picked && picked !== 'a' ? 'is-out' : ''
          }`}
          onClick={() => pick('a')}
        >
          <span className="fighter-key">←</span>
          <span className="fighter-name">{labelA}</span>
        </button>

        <div className={`vs ${picked === 'tie' ? 'is-tie' : ''}`} aria-hidden="true">
          VS
        </div>

        <button
          type="button"
          className={`fighter side-b ${picked === 'b' ? 'is-picked' : ''} ${
            picked && picked !== 'b' ? 'is-out' : ''
          }`}
          onClick={() => pick('b')}
        >
          <span className="fighter-key">→</span>
          <span className="fighter-name">{labelB}</span>
        </button>
      </div>

      <button
        type="button"
        className={`tie-btn ${picked === 'tie' ? 'is-picked' : ''}`}
        onClick={() => pick('tie')}
      >
        差不多
        <span className="tie-key">↓</span>
      </button>

      <p className="pk-foot dim">选左边 ← · 选右边 → · 差不多 ↓</p>
    </section>
  )
}
