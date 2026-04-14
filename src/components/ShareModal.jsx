import { useState, useEffect } from 'react'

export default function ShareModal({ open, onClose, trip }) {
  const [shareLink, setShareLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && trip) {
      generateShareLink()
    }
  }, [open, trip])

  const generateShareLink = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip }),
      })
      const data = await r.json()
      if (!data.ok) {
        setError(data.error || '生成分享链接失败')
        return
      }
      const link = `${window.location.origin}/?share=${data.shareCode}`
      setShareLink(link)
    } catch (err) {
      setError('网络错误，请重试')
      console.error('分享失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      alert('链接已复制到剪贴板')
    } catch (err) {
      setError('复制失败，请手动复制')
    }
  }

  if (!open) return null

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal share-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" onClick={onClose}>
          ×
        </button>
        <h2>分享行程</h2>
        <div className="share-content">
          {loading ? (
            <div className="share-loading">生成分享链接中...</div>
          ) : (
            <>
              <p className="share-tip">分享此链接给好友，他们可以查看你的行程</p>
              {error ? (
                <p className="auth-error">{error}</p>
              ) : (
                <div className="share-link-container">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="share-link-input"
                  />
                  <button
                    type="button"
                    className="share-copy-btn"
                    onClick={copyToClipboard}
                  >
                    复制
                  </button>
                </div>
              )}
              {shareLink && navigator.share && (
                <div className="share-options">
                  <button
                    type="button"
                    className="share-btn"
                    onClick={() => {
                      navigator.share({
                        title: trip.name || '我的旅行行程',
                        text: '查看我的旅行行程',
                        url: shareLink,
                      })
                    }}
                  >
                    📱 系统分享
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
