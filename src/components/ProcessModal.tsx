import { useEffect } from 'react'
import type { Candidate, MatchRecord } from '../lib/decide'

interface Props {
  candidates: Candidate[]
  records: MatchRecord[]
  onClose: () => void
}

export default function ProcessModal({ candidates, records, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const label = (id: string) => candidates.find((c) => c.id === id)?.label ?? '?'

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="PK 过程">
      <div className="overlay-backdrop" onClick={onClose} />
      <div className="overlay-panel">
        <div className="overlay-head">
          <h2 className="card-title">PK 过程</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <ol className="process-list">
          {records.map((r, i) => {
            const win = r.choice === 'tie' ? null : r.choice === 'a' ? r.a : r.b
            return (
              <li key={`${r.a}-${r.b}-${i}`} className="process-row">
                <span className="process-idx">{String(i + 1).padStart(2, '0')}</span>
                <span className={`process-side ${win === r.a ? 'is-win' : ''}`}>
                  {label(r.a)}
                </span>
                <span className="process-result">
                  {r.choice === 'tie' ? '差不多' : 'vs'}
                </span>
                <span className={`process-side ${win === r.b ? 'is-win' : ''}`}>
                  {label(r.b)}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
