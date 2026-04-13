import { useState, useEffect } from 'react'

const NotesModal = ({ open, onClose, note, onSave }) => {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [location, setLocation] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (note) {
      setTitle(note.title)
      setContent(note.content)
      setLocation(note.location)
      setDate(note.date)
    } else {
      setTitle('')
      setContent('')
      setLocation('')
      setDate(new Date().toISOString().split('T')[0])
    }
  }, [note, open])

  if (!open) return null

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const noteData = {
        id: note?.id || Date.now().toString(),
        title,
        content,
        location,
        date,
        createdAt: note?.createdAt || new Date().toISOString()
      }
      onSave(noteData)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal notes-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" onClick={onClose}>
          ×
        </button>
        <h2>{note ? '编辑笔记' : '创建旅行札记'}</h2>
        <form className="auth-form" onSubmit={handleSave}>
          <label>
            标题
            <input
              type="text"
              placeholder="笔记标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label>
            地点
            <input
              type="text"
              placeholder="旅行地点"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label>
            日期
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            内容
            <textarea
              placeholder="记录你的旅行故事..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              required
            />
          </label>
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default NotesModal