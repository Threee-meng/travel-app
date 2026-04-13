import { useCallback, useMemo, useState } from 'react'
import {
  getSessionEmail,
  isValidEmail,
  loginWithCodeOnly,
  loginWithPassword,
  logoutUser,
  normalizeEmail,
  registerUser,
  requestEmailCode,
  verifyEmailCodeOnServer,
} from '../auth/auth'
import { AuthContext } from './auth-context.js'

export function AuthProvider({ children }) {
  const [email, setEmail] = useState(() => getSessionEmail())

  const refreshSession = useCallback(() => {
    setEmail(getSessionEmail())
  }, [])

  const logout = useCallback(() => {
    logoutUser()
    setEmail(null)
  }, [])

  const sendCode = useCallback(async (rawEmail) => {
    const e = normalizeEmail(rawEmail)
    if (!isValidEmail(e)) {
      return { ok: false, error: '请输入有效邮箱' }
    }
    return requestEmailCode(e)
  }, [])

  const register = useCallback(async (rawEmail, code, password, password2) => {
    const e = normalizeEmail(rawEmail)
    if (!isValidEmail(e)) throw new Error('请输入有效邮箱')
    if (!password || password.length < 6) throw new Error('密码至少6位')
    if (password !== password2) throw new Error('两次密码不一致')
    const v = await verifyEmailCodeOnServer(e, code)
    if (!v.ok) throw new Error(v.error)
    await registerUser(e, password)
    setEmail(e)
  }, [])

  const loginPassword = useCallback(async (rawEmail, password) => {
    await loginWithPassword(rawEmail, password)
    setEmail(getSessionEmail())
  }, [])

  const loginCode = useCallback(async (rawEmail, code) => {
    const e = normalizeEmail(rawEmail)
    if (!isValidEmail(e)) throw new Error('请输入有效邮箱')
    const v = await verifyEmailCodeOnServer(e, code)
    if (!v.ok) throw new Error(v.error)
    await loginWithCodeOnly(e)
    setEmail(e)
  }, [])

  const value = useMemo(
    () => ({
      email,
      isLoggedIn: Boolean(email),
      refreshSession,
      logout,
      sendCode,
      register,
      loginPassword,
      loginCode,
    }),
    [email, refreshSession, logout, sendCode, register, loginPassword, loginCode]
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}
