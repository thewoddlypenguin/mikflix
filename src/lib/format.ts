import type { MediaTitle } from '../data/types'

/** Uppercase strings for location stamping */
export function upper(s: string | null | undefined): string {
  return (s ?? '').toUpperCase()
}

export function storageAbbr(s: string): string {
  switch (s) {
    case 'drawer':
      return 'DRAWER'
    case 'binder':
      return 'BINDER'
    case 'shelf':
      return 'SHELF'
    case 'discgear':
      return 'DISC'
    default:
      return s.toUpperCase()
  }
}

export function storageGlyph(s: string): string {
  switch (s) {
    case 'drawer':
      return '▤'
    case 'binder':
      return '⌗'
    case 'shelf':
      return '▥'
    case 'discgear':
      return '◉'
    default:
      return '▪'
  }
}

export function runtimeLabel(t: MediaTitle): string {
  return t.runtime
}

/** Simple deterministic 0..1 hash from a string seed */
export function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}
