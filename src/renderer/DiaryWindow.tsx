// AIGC START
import { useCallback, useEffect, useState } from 'react'
import './diary-window.css'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function friendlyDate(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return {
    month: `${m}月`,
    day: String(d),
    weekday: `周${WEEKDAYS[dt.getDay()]}`,
    full: `${y}年${m}月${d}日`,
  }
}

interface DiaryEntry {
  dateKey: string
  title: string
  moodTag: string
  paragraphs: string[]
  highlights: string[]
  finalized: boolean
}

export function DiaryWindow() {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [selected, setSelected] = useState<DiaryEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!window.petApp) {
      setError('petApp 未就绪')
      setLoading(false)
      return
    }
    window.petApp.listDiaryEntries(60)
      .then((d) => {
        setEntries(d as DiaryEntry[])
        setLoading(false)
      })
      .catch((err) => {
        console.error('[diary-window] load failed:', err)
        setError(String(err?.message ?? err))
        setLoading(false)
      })
  }, [])

  const handleClose = useCallback(() => {
    window.petApp.closeDiaryWindow()
  }, [])

  const currentIdx = selected ? entries.findIndex((e) => e.dateKey === selected.dateKey) : -1
  const hasPrev = currentIdx >= 0 && currentIdx < entries.length - 1
  const hasNext = currentIdx > 0

  const goDay = useCallback(async (dateKey: string) => {
    const cached = entries.find((e) => e.dateKey === dateKey)
    if (cached) { setSelected(cached); return }
    const entry = await window.petApp.getDiaryEntry(dateKey) as DiaryEntry
    if (entry) setSelected(entry)
  }, [entries])

  const goPrev = useCallback(() => {
    if (hasPrev) goDay(entries[currentIdx + 1].dateKey)
  }, [hasPrev, currentIdx, entries, goDay])

  const goNext = useCallback(() => {
    if (hasNext) goDay(entries[currentIdx - 1].dateKey)
  }, [hasNext, currentIdx, entries, goDay])

  if (loading || error) {
    return (
      <div className="dw-root">
        <div className="dw-header">
          <span className="dw-title">木头的日记</span>
          <button className="dw-close" onClick={handleClose}>✕</button>
        </div>
        <div className="dw-loading">{error ?? '翻开日记本中…'}</div>
      </div>
    )
  }

  if (selected) {
    const fd = friendlyDate(selected.dateKey)
    return (
      <div className="dw-root">
        <div className="dw-header dw-header-drag">
          <button className="dw-back" onClick={() => setSelected(null)}>← 返回</button>
          <span className="dw-title">木头的日记</span>
          <button className="dw-close" onClick={handleClose}>✕</button>
        </div>
        <div className="dw-detail">
          <div className="dw-detail-nav">
            <button className="dw-nav-btn" disabled={!hasPrev} onClick={goPrev}>‹ 前一天</button>
            <span className="dw-nav-date">{fd.full} {fd.weekday}</span>
            <button className="dw-nav-btn" disabled={!hasNext} onClick={goNext}>后一天 ›</button>
          </div>
          <div className="dw-detail-mood-line">— {selected.moodTag}</div>
          <h2 className="dw-detail-title">{selected.title}</h2>
          <div className="dw-detail-body">
            {selected.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {selected.highlights.length > 0 && (
            <div className="dw-detail-tags">
              {selected.highlights.map((h, i) => (
                <span key={i} className="dw-tag">{h}</span>
              ))}
            </div>
          )}
          {!selected.finalized && (
            <div className="dw-draft-hint">这一页还在书写中……</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="dw-root">
      <div className="dw-header dw-header-drag">
        <span className="dw-title">木头的日记</span>
        <button className="dw-close" onClick={handleClose}>✕</button>
      </div>
      <div className="dw-list">
        {entries.length === 0 && (
          <div className="dw-empty">还没有日记，明天来翻翻看吧。</div>
        )}
        {entries.map((e) => {
          const fd = friendlyDate(e.dateKey)
          return (
            <div key={e.dateKey} className="dw-item" onClick={() => setSelected(e)}>
              <div className="dw-item-cal">
                <span className="dw-item-day">{fd.day}</span>
                <span className="dw-item-month">{fd.month}</span>
                <span className="dw-item-weekday">{fd.weekday}</span>
              </div>
              <div className="dw-item-body">
                <span className="dw-item-title">{e.title}</span>
                <span className="dw-item-preview">
                  {e.paragraphs[0]?.slice(0, 50) ?? ''}…
                </span>
              </div>
              <span className="dw-item-mood">{e.moodTag}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
// AIGC END
