import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs'
import nodemailer from 'nodemailer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const PORT = Number(process.env.PORT) || 3001
const QQ_EMAIL = process.env.QQ_EMAIL
const QQ_SMTP_CODE = process.env.QQ_SMTP_CODE
const SHARES_FILE = resolveSharesFile()

/** @type {Map<string, { code: string, exp: number }>} */
const codes = new Map()
/** @type {Map<string, number>} */
const lastSent = new Map()

function normEmail(e) {
  return String(e || '').trim().toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function resolveSharesFile() {
  const configuredFile = String(process.env.SHARES_FILE || '').trim()
  if (configuredFile) {
    ensureDir(path.dirname(configuredFile))
    return configuredFile
  }

  const configuredDir = String(process.env.SHARES_DIR || '').trim()
  if (configuredDir) {
    ensureDir(configuredDir)
    return path.join(configuredDir, 'shares.json')
  }

  const railwayVolumePath = String(process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim()
  if (railwayVolumePath) {
    const dataDir = path.join(railwayVolumePath, 'travel-app')
    ensureDir(dataDir)
    return path.join(dataDir, 'shares.json')
  }

  return path.join(__dirname, 'shares.json')
}

function ensureDir(dirPath) {
  if (!dirPath) return
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function normalizeShareCode(value) {
  return String(value ?? '').trim().toUpperCase()
}

function loadShares() {
  try {
    if (fs.existsSync(SHARES_FILE)) {
      return JSON.parse(fs.readFileSync(SHARES_FILE, 'utf-8'))
    }
  } catch (error) {
    console.error('Load shares error:', error)
  }
  return {}
}

function saveShares(shares) {
  try {
    fs.writeFileSync(SHARES_FILE, JSON.stringify(shares, null, 2))
  } catch (error) {
    console.error('Save shares error:', error)
  }
}

function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let index = 0; index < 8; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function createUniqueShareCode(shares) {
  let shareCode = generateShareCode()
  while (shares[shareCode]) {
    shareCode = generateShareCode()
  }
  return shareCode
}

function migrateShareCodeKey(shares, shareCode) {
  const currentKey = Object.keys(shares).find((code) => normalizeShareCode(code) === shareCode)
  if (currentKey && currentKey !== shareCode) {
    shares[shareCode] = shares[currentKey]
    delete shares[currentKey]
  }
}

const app = express()
app.use(cors())
app.use(express.json())

app.post('/api/share', (req, res) => {
  const { trip, shareCode: rawShareCode } = req.body ?? {}
  if (!trip) {
    return res.status(400).json({ ok: false, error: '缺少行程数据' })
  }

  const shares = loadShares()
  let shareCode = normalizeShareCode(rawShareCode)

  if (shareCode) {
    migrateShareCodeKey(shares, shareCode)
  } else {
    shareCode = createUniqueShareCode(shares)
  }

  const existing = shares[shareCode]
  shares[shareCode] = {
    trip: {
      ...trip,
      shareCode,
    },
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    views: existing?.views || 0,
  }
  saveShares(shares)

  res.json({ ok: true, shareCode })
})

app.get('/api/share/:code', (req, res) => {
  const shares = loadShares()
  const inputCode = String(req.params.code ?? '')
  const shareCode = normalizeShareCode(inputCode)
  const currentKey = Object.keys(shares).find(
    (code) => code === inputCode || normalizeShareCode(code) === shareCode,
  )
  const share = currentKey ? shares[currentKey] : null

  if (!share) {
    return res.status(404).json({ ok: false, error: '分享不存在或已失效' })
  }

  if (currentKey && currentKey !== shareCode) {
    shares[shareCode] = share
    delete shares[currentKey]
  }

  share.views = (share.views || 0) + 1
  share.trip = {
    ...share.trip,
    shareCode,
  }
  saveShares(shares)

  res.json({ ok: true, shareCode, trip: share.trip })
})

app.get('/api/health', (_, res) => {
  res.json({
    ok: true,
    mailConfigured: Boolean(QQ_EMAIL && QQ_SMTP_CODE),
  })
})

app.post('/api/email/send-code', async (req, res) => {
  const email = normEmail(req.body?.email)
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: '邮箱格式不正确' })
  }
  if (!QQ_EMAIL || !QQ_SMTP_CODE) {
    return res.status(503).json({
      ok: false,
      error: '服务器未配置 QQ 邮箱：请在 server/.env 中设置 QQ_EMAIL 与 QQ_SMTP_CODE',
    })
  }

  const now = Date.now()
  const prev = lastSent.get(email)
  if (prev && now - prev < 60_000) {
    return res.status(429).json({ ok: false, error: '发送太频繁，请 60 秒后再试' })
  }

  const code = String(Math.floor(100000 + Math.random() * 900000))
  codes.set(email, { code, exp: now + 5 * 60 * 1000 })
  lastSent.set(email, now)

  const transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
      user: QQ_EMAIL,
      pass: QQ_SMTP_CODE,
    },
  })

  try {
    await transporter.sendMail({
      from: `"旅行辣椒" <${QQ_EMAIL}>`,
      to: email,
      subject: '【旅行辣椒】邮箱验证码',
      text: `您的验证码是 ${code}，5 分钟内有效。如非本人操作请忽略。`,
      html: `<p>您的验证码是 <strong style="font-size:18px">${code}</strong>，5 分钟内有效。</p><p>如非本人操作请忽略。</p>`,
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('send mail:', err)
    codes.delete(email)
    let msg = '邮件发送失败：请检查网络后重试'
    if (err.code === 'EAUTH' || /auth|login|535|Invalid/i.test(String(err.message))) {
      msg =
        'QQ 邮箱 SMTP 登录失败：请确认 server/.env 里 QQ_EMAIL 为完整邮箱（如 xxx@qq.com），QQ_SMTP_CODE 为「授权码」而不是 QQ 密码'
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      msg = '无法连接 smtp.qq.com，请检查本机网络或防火墙是否拦截 465 端口'
    } else if (err.responseCode === 550 || /reject|spam/i.test(String(err.message))) {
      msg = '邮件被对方服务器拒收，可换另一个收件邮箱重试'
    }
    res.status(500).json({ ok: false, error: msg })
  }
})

app.post('/api/email/verify-code', (req, res) => {
  const email = normEmail(req.body?.email)
  const input = String(req.body?.code ?? '').trim()
  const row = codes.get(email)
  if (!row) {
    return res.status(400).json({ ok: false, error: '请先获取验证码' })
  }
  if (Date.now() > row.exp) {
    codes.delete(email)
    return res.status(400).json({ ok: false, error: '验证码已过期，请重新获取' })
  }
  if (input !== row.code) {
    return res.status(400).json({ ok: false, error: '验证码错误' })
  }
  codes.delete(email)
  res.json({ ok: true })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`QQ 邮件服务 http://127.0.0.1:${PORT}`)
  console.log(`[travel-app] 分享码存储: ${SHARES_FILE}`)
  if (!QQ_EMAIL || !QQ_SMTP_CODE) {
    console.warn('[travel-app] 未设置 QQ_EMAIL / QQ_SMTP_CODE，发信不可用')
  }
})
