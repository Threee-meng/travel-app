import { useState, useEffect } from 'react'

export default function ShareModal({ open, onClose, trip }) {
  const [shareLink, setShareLink] = useState('')
  const [shareCode, setShareCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !trip) {
      setShareLink('')
      setShareCode('')
      setError('')
      return
    }

    let cancelled = false

    async function generateShareLink() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch('/api/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trip,
            shareCode: trip.shareCode || undefined,
          }),
        })
        const data = await response.json()
        if (!data.ok) {
          if (!cancelled) {
            setError(data.error || '生成分享链接失败')
          }
          return
        }

        const nextShareCode = data.shareCode || trip.shareCode || ''
        const link = `${window.location.origin}/?share=${nextShareCode}`
        if (!cancelled) {
          setShareCode(nextShareCode)
          setShareLink(link)
        }
      } catch (error) {
        if (!cancelled) {
          setError('网络错误，请重试')
        }
        console.error('分享失败:', error)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    generateShareLink()

    return () => {
      cancelled = true
    }
  }, [open, trip])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      alert('链接已复制到剪贴板')
    } catch {
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
                <>
                  <div className="share-code-box">
                    <span>行程码</span>
                    <strong>{shareCode}</strong>
                  </div>
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
                </>
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
