import { useMemo, useRef, useState } from 'react'
import {
  MAX_CANDIDATES,
  MAX_LABEL_LENGTH,
  MIN_CANDIDATES,
  normalizeLabel,
} from '../lib/decide'
import { makeId } from '../lib/storage'

interface Row {
  id: string
  value: string
}

const PLACEHOLDERS = ['火锅', '日料', '烧烤', '麻辣烫', '沙拉', '拉面', '烤肉', '外卖随便']

interface Props {
  initialTitle: string
  initialCandidates: string[]
  restored: boolean
  onStart: (title: string, labels: string[]) => void
  onUseSample: () => void
  onDismissRestored: () => void
  onResume: () => void
}

function makeRow(value = ''): Row {
  return { id: makeId('r'), value }
}

export default function SetupStage({
  initialTitle,
  initialCandidates,
  restored,
  onStart,
  onUseSample,
  onDismissRestored,
  onResume,
}: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [rows, setRows] = useState<Row[]>(() => {
    const base = initialCandidates.length
      ? initialCandidates.map(makeRow)
      : [makeRow(), makeRow(), makeRow()]
    while (base.length < MIN_CANDIDATES) base.push(makeRow())
    return base
  })
  const [showError, setShowError] = useState(false)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const { duplicates, validCount, clean } = useMemo(() => {
    const normalized = rows.map((r) => normalizeLabel(r.value))
    const counts = new Map<string, number>()
    normalized.forEach((n) => {
      if (n) counts.set(n, (counts.get(n) ?? 0) + 1)
    })
    const valid: string[] = []
    normalized.forEach((n) => {
      if (!n) return
      if (counts.get(n) === 1) valid.push(n)
    })
    return {
      duplicates: new Set(normalized.filter((n) => n && (counts.get(n) ?? 0) > 1)),
      validCount: valid.length,
      clean: valid,
    }
  }, [rows])

  const canStart = validCount >= MIN_CANDIDATES
  const atMax = rows.length >= MAX_CANDIDATES

  const setValue = (index: number, value: string) => {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === index ? { ...r, value } : r))
      const isLast = index === next.length - 1
      if (value.trim() && isLast && next.length < MAX_CANDIDATES) {
        next.push(makeRow())
      }
      return next
    })
  }

  const appendRow = () => {
    if (atMax) return
    setRows((prev) => [...prev, makeRow()])
    requestAnimationFrame(() => {
      const inputs = inputsRef.current.filter(Boolean) as HTMLInputElement[]
      inputs[inputs.length - 1]?.focus()
    })
  }

  const removeRow = (id: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((r) => r.id !== id)
      if (next.length === 0) return [makeRow(), makeRow()]
      return next
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const isLast = index === rows.length - 1
      if (isLast && !atMax) {
        appendRow()
      } else {
        inputsRef.current[index + 1]?.focus()
      }
    }
    if (e.key === 'Backspace' && !rows[index].value && rows.length > 1) {
      e.preventDefault()
      removeRow(rows[index].id)
      requestAnimationFrame(() => {
        inputsRef.current[Math.max(0, index - 1)]?.focus()
      })
    }
  }

  const submit = () => {
    setShowError(true)
    if (!canStart) return
    onStart(title.trim() || '未命名决定', clean)
  }

  const errorText = (() => {
    if (validCount >= MIN_CANDIDATES) return ''
    if (validCount === 0) return '先丢一个候选进来。'
    return `至少 ${MIN_CANDIDATES} 个有效候选才能 PK，还差 ${MIN_CANDIDATES - validCount} 个。`
  })()

  return (
    <section className="setup" key="setup">
      <div className="setup-head">
        <h1 className="display-title">
          现在就
          <span className="accent-word">拍板</span>。
        </h1>
        <p className="lede">把纠结的选项丢进来，一个个 PK。</p>
      </div>

      {restored && (
        <div className="notice">
          <span>你上次还有一场 PK 没打完。</span>
          <button
            type="button"
            className="notice-primary"
            onClick={() => {
              onDismissRestored()
              onResume()
            }}
          >
            继续上次 →
          </button>
        </div>
      )}

      <div className="panel">
        <label className="field">
          <span className="field-label">这个决定叫什么</span>
          <input
            className="field-input title-input"
            value={title}
            maxLength={60}
            placeholder="今晚吃什么"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="field">
          <span className="field-label">
            候选 <span className="dim">{validCount} / {MAX_CANDIDATES}</span>
          </span>
          <ul className="candidate-list">
            {rows.map((row, i) => {
              const norm = normalizeLabel(row.value)
              const dup = !!norm && duplicates.has(norm)
              return (
                <li className={`candidate-row ${dup ? 'is-dup' : ''}`} key={row.id}>
                  <span className="row-index">{String(i + 1).padStart(2, '0')}</span>
                  <input
                    ref={(el) => {
                      inputsRef.current[i] = el
                    }}
                    className="field-input candidate-input"
                    value={row.value}
                    maxLength={MAX_LABEL_LENGTH}
                    placeholder={PLACEHOLDERS[i] ?? '再加一个…'}
                    onChange={(e) => setValue(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    aria-invalid={dup}
                  />
                  {dup && <span className="row-flag">重复</span>}
                  <button
                    type="button"
                    className="row-remove"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    aria-label={`删除候选 ${row.value || i + 1}`}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="list-foot">
            <button
              type="button"
              className="chip-btn"
              onClick={appendRow}
              disabled={atMax}
              title={atMax ? `最多 ${MAX_CANDIDATES} 个候选` : '添加一个候选'}
            >
              ＋ 加一个
            </button>
            <span className="hint dim">Enter 快速新增 · 最多 {MAX_CANDIDATES} 个</span>
          </div>
        </div>
      </div>

      <div className="cta-row">
        <button
          type="button"
          className={`cta ${canStart ? '' : 'is-off'}`}
          onClick={submit}
          aria-disabled={!canStart}
        >
          开始 PK <span className="cta-arrow">→</span>
        </button>
        <button type="button" className="cta-quiet" onClick={onUseSample}>
          试试示例
        </button>
      </div>

      {showError && errorText && <p className="error-text">{errorText}</p>}

      <p className="setup-foot dim">
        {MAX_CANDIDATES >= 7
          ? '2–6 个候选：两两都打一遍。7–8 个：先快速赛一轮，前三再循环赛。'
          : '2–6 个候选：两两都打一遍。'}
      </p>
    </section>
  )
}
