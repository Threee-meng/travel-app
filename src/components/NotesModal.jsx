import { useEffect, useState } from 'react'

function normalizeLink(value) {
  return String(value || '').trim()
}

const NotesModal = ({ open, onClose, note, onSave }) => {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [location, setLocation] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [xiaohongshuUrl, setXiaohongshuUrl] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (note) {
      setTitle(note.title || '')
      setContent(note.content || '')
      setLocation(note.location || '')
      setDate(note.date || new Date().toISOString().split('T')[0])
      setXiaohongshuUrl(note.xiaohongshuUrl || '')
    } else {
      setTitle('')
      setContent('')
      setLocation('')
      setDate(new Date().toISOString().split('T')[0])
      setXiaohongshuUrl('')
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
        xiaohongshuUrl: normalizeLink(xiaohongshuUrl),
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
            小红书帖子链接
            <input
              type="url"
              placeholder="粘贴小红书原帖链接，不抓取原帖照片或正文"
              value={xiaohongshuUrl}
              onChange={(e) => setXiaohongshuUrl(e.target.value)}
            />
          </label>
          <div className="note-link-tip">
            合规提示：这里只保存原帖链接和你的个人备注，不抓取、不复制、不展示小红书原帖照片。
          </div>
          <label>
            内容
            <textarea
              placeholder="记录你的旅行故事、灵感备注或避坑信息..."
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
