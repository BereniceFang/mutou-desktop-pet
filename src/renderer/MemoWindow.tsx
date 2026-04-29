// AIGC START
import { useCallback, useEffect, useState } from 'react'
import './memo-window.css'

interface MemoItem {
  id: string
  text: string
  createdAt: string
  remindAt: string | null
  reminded: boolean
  done: boolean
}

export function MemoWindow() {
  const [memos, setMemos] = useState<MemoItem[]>([])
  const [newText, setNewText] = useState('')
  const [newRemind, setNewRemind] = useState('')
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const list = await window.petApp.getMemos() as MemoItem[]
    setMemos(list)
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleClose = useCallback(() => {
    window.petApp.closeMemoWindow()
  }, [])

  const handleAdd = useCallback(async () => {
    const text = newText.trim()
    if (!text) return
    const remindAt = newRemind ? new Date(newRemind).toISOString() : null
    await window.petApp.addMemo(text, remindAt)
    setNewText('')
    setNewRemind('')
    reload()
  }, [newText, newRemind, reload])

  const handleToggle = useCallback(async (id: string) => {
    await window.petApp.toggleMemoDone(id)
    reload()
  }, [reload])

  const handleDelete = useCallback(async (id: string) => {
    await window.petApp.deleteMemo(id)
    reload()
  }, [reload])

  const pending = memos.filter((m) => !m.done)
  const done = memos.filter((m) => m.done)

  return (
    <div className="mw-root">
      <div className="mw-header mw-header-drag">
        <span className="mw-title">木头的便签</span>
        <button className="mw-close" onClick={handleClose}>✕</button>
      </div>

      <div className="mw-add">
        <input
          className="mw-add-input"
          type="text"
          value={newText}
          placeholder="写点什么让木头帮你记着..."
          maxLength={200}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <div className="mw-add-row">
          <input
            className="mw-add-time"
            type="datetime-local"
            value={newRemind}
            onChange={(e) => setNewRemind(e.target.value)}
          />
          <button className="mw-add-btn" onClick={handleAdd}>记下</button>
        </div>
      </div>

      <div className="mw-list">
        {loading && <div className="mw-empty">加载中...</div>}
        {!loading && pending.length === 0 && done.length === 0 && (
          <div className="mw-empty">还没有便签，写一条试试吧。</div>
        )}

        {pending.map((m) => (
          <div key={m.id} className="mw-item">
            <button className="mw-check" onClick={() => handleToggle(m.id)}>○</button>
            <div className="mw-item-body">
              <span className="mw-item-text">{m.text}</span>
              {m.remindAt && (
                <span className={`mw-item-time ${m.reminded ? 'reminded' : ''}`}>
                  {m.reminded ? '已提醒' : `提醒: ${new Date(m.remindAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                </span>
              )}
            </div>
            <button className="mw-del" onClick={() => handleDelete(m.id)}>✕</button>
          </div>
        ))}

        {done.length > 0 && (
          <>
            <div className="mw-section-title">已完成</div>
            {done.map((m) => (
              <div key={m.id} className="mw-item mw-item-done">
                <button className="mw-check checked" onClick={() => handleToggle(m.id)}>✓</button>
                <div className="mw-item-body">
                  <span className="mw-item-text">{m.text}</span>
                </div>
                <button className="mw-del" onClick={() => handleDelete(m.id)}>✕</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
// AIGC END
