import cors from 'cors'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001
const SHARES_FILE = resolveSharesFile()

const app = express()
app.use(cors())
app.use(express.json())

// 静态文件托管（支持SPA fallback）
const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))

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

function normalizeShareCode(value) {
  return String(value ?? '').trim().toUpperCase()
}

// 生成分享码
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
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

// 保存分享的行程
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

// 获取分享的行程
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
  console.log(`   分享码存储: ${SHARES_FILE}`)
})
