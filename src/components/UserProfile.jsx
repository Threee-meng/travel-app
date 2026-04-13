import { useState, useEffect } from 'react'
import { useAuth } from '../context/useAuth'

const UserProfile = ({ open, onClose }) => {
  const { email } = useAuth()
  const [profile, setProfile] = useState({
    name: '',
    avatar: '',
    bio: '',
    phone: '',
    birthday: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && email) {
      loadProfile()
    }
  }, [open, email])

  const loadProfile = () => {
    try {
      const saved = localStorage.getItem(`user-profile-${email}`)
      if (saved) {
        setProfile(JSON.parse(saved))
      }
    } catch (err) {
      console.error('加载个人资料失败:', err)
    }
  }

  const saveProfile = async () => {
    setLoading(true)
    setError('')
    try {
      if (email) {
        localStorage.setItem(`user-profile-${email}`, JSON.stringify(profile))
        onClose()
      }
    } catch (err) {
      setError('保存失败，请重试')
      console.error('保存个人资料失败:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" onClick={onClose}>
          ×
        </button>
        <h2>个人资料</h2>
        <div className="profile-form">
          <div className="profile-field">
            <label>邮箱</label>
            <input
              type="email"
              value={email}
              disabled
              className="profile-input disabled"
            />
          </div>
          
          <div className="profile-field">
            <label>姓名</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="profile-input"
              placeholder="请输入姓名"
            />
          </div>
          
          <div className="profile-field">
            <label>头像</label>
            <input
              type="text"
              value={profile.avatar}
              onChange={(e) => setProfile({ ...profile, avatar: e.target.value })}
              className="profile-input"
              placeholder="输入头像URL"
            />
          </div>
          
          <div className="profile-field">
            <label>个人简介</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className="profile-textarea"
              placeholder="介绍一下自己..."
              rows={3}
            />
          </div>
          
          <div className="profile-field">
            <label>手机号</label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="profile-input"
              placeholder="请输入手机号"
            />
          </div>
          
          <div className="profile-field">
            <label>生日</label>
            <input
              type="date"
              value={profile.birthday}
              onChange={(e) => setProfile({ ...profile, birthday: e.target.value })}
              className="profile-input"
            />
          </div>
          
          {error && <p className="auth-error">{error}</p>}
          
          <div className="profile-actions">
            <button
              type="button"
              className="auth-submit secondary"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="auth-submit"
              onClick={saveProfile}
              disabled={loading}
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserProfile