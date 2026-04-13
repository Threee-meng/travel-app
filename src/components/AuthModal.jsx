import { useEffect, useState } from 'react'
import { userExists } from '../auth/auth'
import { useAuth } from '../context/useAuth'
import './AuthModal.css'

export default function AuthModal({ open, onClose, initialMode = 'login' }) {
  const { sendCode, register, loginPassword, loginCode } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [loginWay, setLoginWay] = useState('password')

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentHint, setSentHint] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (open) {
      setMode(initialMode)
      setError('')
      setSentHint(false)
    }
  }, [open, initialMode])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const t = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [cooldown])

  if (!open) return null

  const handleSendCode = async () => {
    setError('')
    if (mode === 'register' && userExists(email)) {
      setError('该邮箱已注册，请直接登录')
      return
    }
    if (mode === 'login' && loginWay === 'code' && !userExists(email)) {
      setError('该邮箱尚未注册，请先注册')
      return
    }
    setSending(true)
    try {
      const r = await sendCode(email)
      if (!r.ok) {
        setError(r.error || '发送失败')
        return
      }
      setSentHint(true)
      setCooldown(60)
    } finally {
      setSending(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(email, code, password, password2)
      onClose()
    } catch (err) {
      setError(err.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const handleLoginPassword = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginPassword(email, password)
      onClose()
    } catch (err) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleLoginCode = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginCode(email, code)
      onClose()
    } catch (err) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" onClick={onClose}>
          ×
        </button>
        <div className="auth-modal-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login')
              setError('')
            }}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register')
              setError('')
            }}
          >
            注册
          </button>
        </div>

        {mode === 'register' && (
          <form className="auth-form" onSubmit={handleRegister}>
            <label>
              邮箱
              <input
                type="email"
                autoComplete="email"
                placeholder="用于接收验证码"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <div className="auth-code-row">
              <label className="auth-code-input">
                验证码
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="6位验证码"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                />
              </label>
              <button
                type="button"
                className="auth-send-code"
                disabled={cooldown > 0 || sending}
                onClick={handleSendCode}
              >
                {sending ? '发送中…' : cooldown > 0 ? `${cooldown}s` : '获取验证码'}
              </button>
            </div>
            {sentHint ? (
              <p className="auth-mail-hint">
                验证码已发送，请到邮箱查收（含垃圾箱）。若未收到可稍候重试。
              </p>
            ) : null}
            <label>
              设置密码
              <input
                type="password"
                autoComplete="new-password"
                placeholder="至少6位"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              确认密码
              <input
                type="password"
                autoComplete="new-password"
                placeholder="再次输入密码"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
              />
            </label>
            {error ? <p className="auth-error">{error}</p> : null}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? '提交中…' : '注册并登录'}
            </button>
          </form>
        )}

        {mode === 'login' && (
          <div className="auth-login-body">
            <div className="auth-login-switch">
              <button
                type="button"
                className={loginWay === 'password' ? 'on' : ''}
                onClick={() => {
                  setLoginWay('password')
                  setError('')
                }}
              >
                密码登录
              </button>
              <button
                type="button"
                className={loginWay === 'code' ? 'on' : ''}
                onClick={() => {
                  setLoginWay('code')
                  setError('')
                }}
              >
                验证码登录
              </button>
            </div>

            {loginWay === 'password' ? (
              <form className="auth-form" onSubmit={handleLoginPassword}>
                <label>
                  邮箱
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="注册时使用的邮箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  密码
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="登录密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                {error ? <p className="auth-error">{error}</p> : null}
                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? '登录中…' : '登录'}
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleLoginCode}>
                <label>
                  邮箱
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="注册时使用的邮箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <div className="auth-code-row">
                  <label className="auth-code-input">
                    验证码
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="6位验证码"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="auth-send-code"
                    disabled={cooldown > 0 || sending}
                    onClick={handleSendCode}
                  >
                    {sending ? '发送中…' : cooldown > 0 ? `${cooldown}s` : '获取验证码'}
                  </button>
                </div>
                {sentHint ? (
                  <p className="auth-mail-hint">
                    验证码已发送，请到邮箱查收（含垃圾箱）。
                  </p>
                ) : null}
                {error ? <p className="auth-error">{error}</p> : null}
                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? '登录中…' : '验证码登录'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
