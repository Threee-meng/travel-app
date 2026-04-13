import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import nodemailer from 'nodemailer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, 'server/.env') })

const PORT = Number(process.env.PORT) || 3001
const QQ_EMAIL = process.env.QQ_EMAIL
const QQ_SMTP_CODE = process.env.QQ_SMTP_CODE

const codes = new Map()
const lastSent = new Map()

function normEmail(e) {
  return String(e || '').trim().toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_, res) => {
  res.json({ ok: true, mailConfigured: Boolean(QQ_EMAIL && QQ_SMTP_CODE) })
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
    auth: { user: QQ_EMAIL, pass: QQ_SMTP_CODE },
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
      msg = 'QQ 邮箱 SMTP 登录失败：请确认 server/.env 里 QQ_EMAIL 为完整邮箱（如 xxx@qq.com），QQ_SMTP_CODE 为「授权码」而不是 QQ 密码'
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
  if (!row) return res.status(400).json({ ok: false, error: '请先获取验证码' })
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

// 静态文件托管（支持SPA fallback）
const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 旅行辣椒已启动！`)
  console.log(`   访问地址: http://localhost:${PORT}`)
  if (!QQ_EMAIL || !QQ_SMTP_CODE) {
    console.warn('[注意] 未设置 QQ_EMAIL / QQ_SMTP_CODE，发信功能不可用')
  }
})
