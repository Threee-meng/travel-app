import cors from 'cors'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001

const app = express()
app.use(cors())
app.use(express.json())

// 静态文件托管（支持SPA fallback）
const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))

// 分享数据存储（简单的JSON文件）
const SHARES_FILE = path.join(__dirname, 'shares.json')

function loadShares() {
  try {
    if (fs.existsSync(SHARES_FILE)) {
      return JSON.parse(fs.readFileSync(SHARES_FILE, 'utf-8'))
    }
  } catch (e) {
    console.error('Load shares error:', e)
  }
  return {}
}

function saveShares(shares) {
  try {
    fs.writeFileSync(SHARES_FILE, JSON.stringify(shares, null, 2))
  } catch (e) {
    console.error('Save shares error:', e)
  }
}

// 生成分享码
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// 保存分享的行程
app.post('/api/share', (req, res) => {
  const { trip } = req.body
  if (!trip) {
    return res.status(400).json({ ok: false, error: '缺少行程数据' })
  }

  const shares = loadShares()
  let shareCode = generateShareCode()
  // 避免重复
  while (shares[shareCode]) {
    shareCode = generateShareCode()
  }

  shares[shareCode] = {
    trip,
    createdAt: new Date().toISOString(),
    views: 0
  }
  saveShares(shares)

  res.json({ ok: true, shareCode })
})

// 获取分享的行程
app.get('/api/share/:code', (req, res) => {
  const { code } = req.params
  const shares = loadShares()
  const share = shares[code]

  if (!share) {
    return res.status(404).json({ ok: false, error: '分享不存在或已失效' })
  }

  share.views = (share.views || 0) + 1
  saveShares(shares)

  res.json({ ok: true, trip: share.trip })
})

// 健康检查
app.get('/api/health', (_, res) => {
  res.json({ ok: true })
})

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 旅行辣椒已启动！`)
  console.log(`   访问地址: http://localhost:${PORT}`)
})
