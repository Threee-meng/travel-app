import { sha256 } from 'js-sha256'

const USERS_KEY = 'travel-app-users-v2'
const SESSION_KEY = 'travel-app-session-v2'

export function isValidEmail(raw) {
  const e = String(raw || '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase()
}

/** 使用 js-sha256：在非安全上下文（如 http://局域网IP）下 Web Crypto subtle 不可用，会导致注册失败 */
function hashPassword(password) {
  return sha256(password)
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export async function requestEmailCode(email) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const r = await fetch('/api/email/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizeEmail(email) }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return { ok: false, error: data.error || '发送失败' }
    }
    if (!data.ok) {
      return { ok: false, error: data.error || '发送失败' }
    }
    return { ok: true }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, error: '请求超时，请检查网络后重试' }
    }
    return {
      ok: false,
      error: '无法连接发信服务，请检查网络后重试',
    }
  }
}

export async function verifyEmailCodeOnServer(email, code) {
  try {
    const r = await fetch('/api/email/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizeEmail(email),
        code: String(code).trim(),
      }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return { ok: false, error: data.error || '验证失败' }
    }
    if (!data.ok) {
      return { ok: false, error: data.error || '验证失败' }
    }
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: '无法连接发信服务：请先在本机运行 npm run server 或使用 npm run dev:all',
    }
  }
}

export async function registerUser(email, password) {
  const e = normalizeEmail(email)
  if (!isValidEmail(e)) throw new Error('请输入有效邮箱')
  const users = loadUsers()
  if (users.some((u) => u.email === e)) throw new Error('该邮箱已注册，请直接登录')
  const passwordHash = hashPassword(password)
  users.push({ email: e, passwordHash })
  saveUsers(users)
  setSession(e)
  migrateAnonymousTrips(e)
  return { email: e }
}

export function userExists(email) {
  const e = normalizeEmail(email)
  return loadUsers().some((u) => u.email === e)
}

export async function loginWithPassword(email, password) {
  const e = normalizeEmail(email)
  if (!isValidEmail(e)) throw new Error('请输入有效邮箱')
  const users = loadUsers()
  const u = users.find((x) => x.email === e)
  if (!u) throw new Error('该邮箱未注册')
  const h = hashPassword(password)
  if (h !== u.passwordHash) throw new Error('密码错误')
  setSession(e)
  migrateAnonymousTrips(e)
  return { email: e }
}

export async function loginWithCodeOnly(email) {
  const e = normalizeEmail(email)
  if (!isValidEmail(e)) throw new Error('请输入有效邮箱')
  if (!userExists(e)) throw new Error('该邮箱未注册，请先注册')
  setSession(e)
  migrateAnonymousTrips(e)
  return { email: e }
}

export function logoutUser() {
  localStorage.removeItem(SESSION_KEY)
}

export function getSessionEmail() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    return s.email || null
  } catch {
    return null
  }
}

function setSession(email) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email }))
}

function migrateAnonymousTrips(email) {
  const anon = localStorage.getItem('travel-trips')
  const key = `travel-trips-${email}`
  if (anon && !localStorage.getItem(key)) {
    localStorage.setItem(key, anon)
  }
}
