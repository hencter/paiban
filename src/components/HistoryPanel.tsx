import { useState } from 'react'
import type { HistoryEntry } from '../lib/storage'

interface Props {
  entries: HistoryEntry[]
  onClose: () => void
  onClear: () => void
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

export default function HistoryPanel({ entries, onClose, onClear }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="历史记录">
      <div className="overlay-backdrop" onClick={onClose} />
      <aside className="overlay-panel side-panel">
        <div className="overlay-head">
          <h2 className="card-title">历史</h2>
          <div className="overlay-head-actions">
            {entries.length > 0 && (
              <button type="button" className="btn-quiet btn-sm" onClick={onClear}>
                清空
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
              ×
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="empty dim">还没有记录。做完一个决定之后，它会留在这里。</p>
        ) : (
          <ul className="history-list">
            {entries.map((e) => {
              const open = openId === e.id
              return (
                <li key={e.id} className={`history-item ${open ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="history-head"
                    onClick={() => setOpenId(open ? null : e.id)}
                  >
                    <span className="history-title">{e.title}</span>
                    <span className="history-winner">{e.winner}</span>
                    {e.resolution === 'overridden' && (
                      <span className="tag">改选</span>
                    )}
                    <span className="history-time dim">{formatTime(e.createdAt)}</span>
                  </button>
                  {open && (
                    <div className="history-detail">
                      <ol className="rank-list compact">
                        {e.standings.map((s, i) => (
                          <li className={`rank-row ${i === 0 ? 'is-first' : ''}`} key={s.label}>
                            <span className="rank-num">{String(i + 1).padStart(2, '0')}</span>
                            <span className="rank-body">
                              <span className="rank-name">{s.label}</span>
                              <span className="rank-sub">
                                {s.played} 场 · {s.wins} 胜 {s.losses} 负
                                {s.ties ? ` ${s.ties} 平` : ''} · {s.points} 分
                              </span>
                            </span>
                          </li>
                        ))}
                      </ol>
                      <p className="dim tiny">{e.records.length} 场二选一</p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </aside>
    </div>
  )
}
