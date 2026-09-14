import { useEffect, useRef } from 'react'
import { hashSeed } from '../../lib/format'
import './Poster.css'

interface PosterProps {
  seed: string
  hue: number
  motif?: 'ring' | 'arch' | 'horizon' | 'emblem' | 'mono'
  title: string
  width?: number
  height?: number
}

/**
 * Color kit for one poster. Every function returns a valid canvas color;
 * call with an alpha argument for translucent variants.
 */
function palette(h: number) {
  const mk = (s: number, l: number) => (a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`
  return {
    h,
    bg0: mk(34, 8)(),
    bg1: `hsla(${(h + 18) % 360}, 40%, 13%, 1)`,
    ink: mk(26, 88),
    accent: mk(72, 62),
    glow: mk(85, 58),
    line: mk(30, 30),
  }
}

/** Deterministic PRNG so every render of a seed draws the same art */
function rng(seed: number) {
  let s = Math.floor(seed * 2 ** 31) || 1
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 31
    return s / 2 ** 31
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

export function Poster({ seed, hue, motif = 'ring', title, width = 340, height = 510 }: PosterProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const p = palette(hue)
    const r = rng(hashSeed(seed))

    // base wash
    const grad = ctx.createLinearGradient(0, 0, width * 0.4, height)
    grad.addColorStop(0, p.bg1)
    grad.addColorStop(1, p.bg0)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)

    // vignette
    const vig = ctx.createRadialGradient(
      width / 2,
      height * 0.42,
      height * 0.1,
      width / 2,
      height * 0.45,
      height * 0.75,
    )
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, width, height)

    // scattered dust
    ctx.fillStyle = 'rgba(255,240,210,0.06)'
    for (let i = 0; i < 42; i++) {
      const x = r() * width
      const y = r() * height
      const s = r() * 1.4 + 0.3
      ctx.fillRect(x, y, s, s)
    }

    const cx = width / 2

    if (motif === 'ring') {
      // glowing ring + halo — concerts, artifacts, relics
      const ringY = height * 0.38
      const rad = width * (0.22 + r() * 0.08)
      const halo = ctx.createRadialGradient(cx, ringY, rad * 0.2, cx, ringY, rad * 1.9)
      halo.addColorStop(0, p.glow(0.33))
      halo.addColorStop(1, 'transparent')
      ctx.fillStyle = halo
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = p.accent()
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.arc(cx, ringY, rad, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = p.line(0.67)
      ctx.lineWidth = 1
      for (let i = 0; i < 3; i++) {
        const rr = rad * (1.3 + i * 0.28)
        ctx.beginPath()
        ctx.arc(cx, ringY, rr, r() * 6.28, r() * 6.28 + 2 + r() * 3)
        ctx.stroke()
      }
      // orbit dot
      const ang = r() * 6.28
      ctx.fillStyle = p.ink()
      ctx.beginPath()
      ctx.arc(cx + Math.cos(ang) * rad * 1.45, ringY + Math.sin(ang) * rad * 1.45, 2.4, 0, 7)
      ctx.fill()
    }

    if (motif === 'arch') {
      // nested arches — gates, doorways, interiors
      const baseY = height * 0.62
      for (let i = 4; i >= 0; i--) {
        const w = width * (0.16 + i * 0.09)
        const h = height * (0.2 + i * 0.075)
        ctx.beginPath()
        ctx.moveTo(cx - w / 2, baseY)
        ctx.lineTo(cx - w / 2, baseY - h + w / 2)
        ctx.arc(cx, baseY - h + w / 2, w / 2, Math.PI, 0)
        ctx.lineTo(cx + w / 2, baseY)
        ctx.closePath()
        const g = ctx.createLinearGradient(0, baseY - h, 0, baseY)
        g.addColorStop(0, i % 2 ? p.accent(0.18) : p.glow(0.11))
        g.addColorStop(1, 'rgba(0,0,0,0.35)')
        ctx.fillStyle = g
        ctx.fill()
        ctx.strokeStyle = i === 2 ? p.accent() : p.line(0.6)
        ctx.lineWidth = i === 2 ? 2 : 1
        ctx.stroke()
      }
      // threshold beam
      const beam = ctx.createLinearGradient(0, baseY - height * 0.5, 0, baseY)
      beam.addColorStop(0, 'transparent')
      beam.addColorStop(1, p.glow(0.13))
      ctx.fillStyle = beam
      ctx.fillRect(cx - width * 0.1, baseY - height * 0.5, width * 0.2, height * 0.5)
    }

    if (motif === 'horizon') {
      // low sun over layered ridges — savannas, islands, frontiers
      const sunY = height * 0.46
      const sunR = width * 0.19
      const sun = ctx.createRadialGradient(cx, sunY, 2, cx, sunY, sunR * 2.4)
      sun.addColorStop(0, p.glow(0.8))
      sun.addColorStop(0.45, p.accent(0.33))
      sun.addColorStop(1, 'transparent')
      ctx.fillStyle = sun
      ctx.fillRect(0, 0, width, height)
      ctx.beginPath()
      ctx.arc(cx, sunY, sunR, 0, Math.PI * 2)
      ctx.fillStyle = p.accent(0.9)
      ctx.fill()
      // ridgelines
      for (let l = 0; l < 3; l++) {
        const base = height * (0.56 + l * 0.09)
        ctx.beginPath()
        ctx.moveTo(0, height)
        let y = base + r() * 14
        ctx.lineTo(0, y)
        const steps = 7 + Math.floor(r() * 4)
        for (let i = 1; i <= steps; i++) {
          const x = (width / steps) * i
          y = base + (r() - 0.5) * (26 - l * 7)
          ctx.lineTo(x, y)
        }
        ctx.lineTo(width, height)
        ctx.closePath()
        ctx.fillStyle = `hsla(${hue}, 30%, ${8 + l * 4}%, 0.92)`
        ctx.fill()
      }
    }

    if (motif === 'emblem') {
      // seal + rays + star/badge — franchises, teams, houses
      const cy = height * 0.36
      const rad = width * 0.24
      // rays
      ctx.save()
      ctx.translate(cx, cy)
      for (let i = 0; i < 12; i++) {
        ctx.rotate((Math.PI * 2) / 12)
        ctx.beginPath()
        ctx.moveTo(rad * 1.08, 0)
        ctx.lineTo(rad * (1.55 + r() * 0.35), 0)
        ctx.strokeStyle = i % 2 ? p.glow(0.19) : p.line(0.4)
        ctx.lineWidth = 2
        ctx.stroke()
      }
      ctx.restore()
      // concentric seals
      ctx.strokeStyle = p.accent()
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.arc(cx, cy, rad, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = p.line(0.67)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, rad * 0.78, 0, Math.PI * 2)
      ctx.stroke()
      // star
      const spikes = 5
      const outer = rad * 0.55
      const inner = outer * 0.44
      ctx.beginPath()
      for (let i = 0; i < spikes * 2; i++) {
        const rr = i % 2 ? inner : outer
        const a = (Math.PI * i) / spikes - Math.PI / 2
        const x = cx + Math.cos(a) * rr
        const y = cy + Math.sin(a) * rr
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
      }
      ctx.closePath()
      ctx.fillStyle = p.ink(0.93)
      ctx.fill()
    }

    if (motif === 'mono') {
      // stark typewriter minimalism — one glyph, hard shadow
      const glyph = title.replace(/^(the|a|an)\s+/i, '').charAt(0).toUpperCase() || '?'
      const gy = height * 0.4
      ctx.font = `700 ${height * 0.34}px Fraunces, Georgia, serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillText(glyph, cx + 5, gy + 6)
      const g = ctx.createLinearGradient(0, gy - 80, 0, gy + 80)
      g.addColorStop(0, p.ink())
      g.addColorStop(1, p.accent())
      ctx.fillStyle = g
      ctx.fillText(glyph, cx, gy)
      // hairline frame
      ctx.strokeStyle = p.line(0.67)
      ctx.lineWidth = 1
      ctx.strokeRect(width * 0.1, height * 0.12, width * 0.8, height * 0.5)
    }

    // title block
    const blockY = height * 0.68
    ctx.fillStyle = 'rgba(10, 7, 5, 0.32)'
    ctx.fillRect(0, blockY - 8, width, height - blockY + 8)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = `600 ${width > 260 ? 24 : 19}px Fraunces, Georgia, serif`
    ctx.fillStyle = p.ink()
    const lines = wrapText(ctx, title, width * 0.82).slice(0, 3)
    lines.forEach((ln, i) => {
      ctx.fillText(ln, cx, blockY + 10 + i * 28)
    })
    // baseline rule
    ctx.fillStyle = p.accent()
    ctx.fillRect(width * 0.5 - 22, blockY + 12 + lines.length * 28, 44, 2)
  }, [seed, hue, motif, title, width, height])

  return (
    <canvas
      ref={ref}
      className="poster-canvas"
      style={{ aspectRatio: '2 / 3', width: '100%' }}
      role="img"
      aria-label={`Poster art for ${title}`}
    />
  )
}