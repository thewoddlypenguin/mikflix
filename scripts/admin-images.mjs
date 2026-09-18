// Mikflix — Manual image override API (zero-dependency node:http)
//
// Purpose:
//   Lets the curator set a manual image (remote URL or uploaded file) for any
//   title. Writes the value back to BOTH titles.json copies so the static
//   bundle picks it up on the next fetch:
//     - src/data/generated/titles.json   (source of truth for rebuilds)
//     - public/titles.json               (served to the frontend in dev)
//
// Endpoints:
//   GET  /api/titles                 → [{ id, title, manual_image_url }, ...]
//   POST /api/manual-image           → { titleId, url }        (set override)
//   POST /api/manual-image/upload    → multipart (titleId, file) (save to public/images/)
//   DELETE /api/manual-image?titleId=…                          (clear override)
//
// The frontend talks to it via the /api plugin in vite.config.ts, so in dev
// everything stays on one origin (no CORS). In production the writes go
// through the same script (`npm run admin:api`) behind a reverse proxy.

import { createServer } from 'node:http'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const GENERATED_PATH = join(ROOT, 'src', 'data', 'generated', 'titles.json')
const PUBLIC_PATH = join(ROOT, 'public', 'titles.json')
const IMAGES_DIR = join(ROOT, 'public', 'images')

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'])
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8 MB

const PORT = Number(process.env.ADMIN_API_PORT) || 4545

function readBundle() {
  return JSON.parse(readFileSync(GENERATED_PATH, 'utf8'))
}

function writeBundle(bundle) {
  // Update generated_at so the UI footer reflects the latest edit
  bundle.generated_at = new Date().toISOString()
  const json = JSON.stringify(bundle, null, 2)
  writeFileSync(GENERATED_PATH, json, 'utf8')
  writeFileSync(PUBLIC_PATH, json, 'utf8')
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

function readBody(req, limit = MAX_UPLOAD_BYTES) {
  return new Promise((resolvePromise, reject) => {
    const chunks = []
    let size = 0
    req.on('data', chunk => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolvePromise(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** Minimal multipart/form-data parser — enough for one file + text fields. */
function parseMultipart(buffer, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)
  if (!m) return null
  const boundary = '--' + (m[1] || m[2])
  const parts = {}
  const boundaryBuf = Buffer.from(boundary)
  let start = buffer.indexOf(boundaryBuf)
  while (start !== -1) {
    const headStart = start + boundaryBuf.length + 2 // skip CRLF
    const headEnd = buffer.indexOf('\r\n\r\n', headStart)
    if (headEnd === -1) break
    const next = buffer.indexOf(boundaryBuf, headEnd)
    if (next === -1) break
    const head = buffer.slice(headStart, headEnd).toString('utf8')
    const body = buffer.slice(headEnd + 4, next - 2) // strip trailing CRLF
    const nameMatch = /name="([^"]*)"/i.exec(head)
    const fileMatch = /filename="([^"]*)"/i.exec(head)
    if (nameMatch) {
      parts[nameMatch[1]] = fileMatch
        ? { filename: fileMatch[1], data: body }
        : body.toString('utf8')
    }
    start = next
  }
  return parts
}

const SAFE_EXT = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
  ['image/gif', '.gif'],
])

function extFromFilenameOrMime(filename, buffer) {
  const byExt = extname(filename || '').toLowerCase()
  if (ALLOWED_EXTENSIONS.has(byExt)) return byExt
  // sniff magic bytes
  const b = buffer
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8) return '.jpg'
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return '.png'
  if (b.length > 12 && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return '.webp'
  if (b.length > 12 && b.slice(4, 8).toString() === 'ftyp') return '.avif'
  if (b.length > 6 && b.slice(0, 3).toString() === 'GIF') return '.gif'
  return null
}

async function handle(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (!url.pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'not found' })
    return
  }

  // ---- GET /api/titles ----------------------------------------------------
  if (req.method === 'GET' && url.pathname === '/api/titles') {
    const bundle = readBundle()
    sendJson(res, 200, bundle.titles.map(t => ({
      id: t.id,
      title: t.display_title,
      year: t.release_year,
      media_type: t.media_type,
      manual_image_url: t.manual_image_url ?? null,
      poster_path: t.poster_path ?? null,
    })))
    return
  }

  // ---- POST /api/manual-image (set by URL) --------------------------------
  if (req.method === 'POST' && url.pathname === '/api/manual-image') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}')
    const { titleId, url: imageUrl } = body
    if (!titleId || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      sendJson(res, 400, { error: 'titleId and url are required' })
      return
    }
    const trimmed = imageUrl.trim()
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')) {
      sendJson(res, 400, { error: 'url must be http(s) or a site-relative /path' })
      return
    }
    const bundle = readBundle()
    const title = bundle.titles.find(t => t.id === titleId)
    if (!title) {
      sendJson(res, 404, { error: `unknown titleId: ${titleId}` })
      return
    }
    title.manual_image_url = trimmed
    writeBundle(bundle)
    sendJson(res, 200, { ok: true, titleId, manual_image_url: trimmed })
    return
  }

  // ---- POST /api/manual-image/upload (set by file) ------------------------
  if (req.method === 'POST' && url.pathname === '/api/manual-image/upload') {
    const contentType = req.headers['content-type'] || ''
    if (!contentType.includes('multipart/form-data')) {
      sendJson(res, 400, { error: 'expected multipart/form-data' })
      return
    }
    const parts = parseMultipart(await readBody(req), contentType)
    if (!parts?.titleId || !parts?.file?.data) {
      sendJson(res, 400, { error: 'titleId and file are required' })
      return
    }
    const ext = extFromFilenameOrMime(parts.file.filename, parts.file.data)
    if (!ext) {
      sendJson(res, 400, { error: 'unsupported image type (jpg, png, webp, avif, gif)' })
      return
    }
    const bundle = readBundle()
    const title = bundle.titles.find(t => t.id === parts.titleId)
    if (!title) {
      sendJson(res, 404, { error: `unknown titleId: ${parts.titleId}` })
      return
    }
    mkdirSync(IMAGES_DIR, { recursive: true })
    // slug from title id + short random suffix; collisions practically impossible
    const safeBase = title.id.replace(/[^a-z0-9-]/gi, '_').slice(0, 64)
    const filename = `${safeBase}-${randomBytes(4).toString('hex')}${ext}`
    const destPath = join(IMAGES_DIR, filename)
    writeFileSync(destPath, parts.file.data)
    const sitePath = `/images/${filename}`
    title.manual_image_url = sitePath
    writeBundle(bundle)
    sendJson(res, 200, { ok: true, titleId: title.id, manual_image_url: sitePath })
    return
  }

  // ---- DELETE /api/manual-image -------------------------------------------
  if (req.method === 'DELETE' && url.pathname === '/api/manual-image') {
    const titleId = url.searchParams.get('titleId')
    if (!titleId) {
      sendJson(res, 400, { error: 'titleId query param required' })
      return
    }
    const bundle = readBundle()
    const title = bundle.titles.find(t => t.id === titleId)
    if (!title) {
      sendJson(res, 404, { error: `unknown titleId: ${titleId}` })
      return
    }
    delete title.manual_image_url
    writeBundle(bundle)
    sendJson(res, 200, { ok: true, titleId, manual_image_url: null })
    return
  }

  sendJson(res, 404, { error: 'unknown endpoint' })
}

export function createAdminImageServer() {
  return createServer((req, res) => {
    handle(req, res).catch(err => {
      console.error('admin-images API error:', err.message)
      if (!res.headersSent) sendJson(res, 500, { error: err.message })
    })
  })
}

// Run directly (node scripts/admin-images.mjs) — not when imported by Vite
const invoked = process.argv[1]?.replace(/\\/g, '/').split('/').pop()
if (invoked === 'admin-images.mjs') {
  createAdminImageServer().listen(PORT, () => {
    console.log(`🗝  admin-images API on http://localhost:${PORT}`)
    console.log(`   writes: ${GENERATED_PATH}`)
    console.log(`         + ${PUBLIC_PATH}`)
    console.log(`   uploads → ${IMAGES_DIR}`)
  })
}
