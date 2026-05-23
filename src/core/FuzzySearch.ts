import { h, type VNode } from 'vue'
import type { Command, SearchResult } from '../types'

function normalize(str: string): string {
  return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function scoreMatch(query: string, text: string): { score: number; matches: Array<[number, number]> } {
  const q = normalize(query)
  const t = normalize(text)

  if (!q) return { score: 0, matches: [] }

  // 1. Exact match
  if (t === q) return { score: 100, matches: [[0, text.length - 1]] }

  // 2. Prefix match
  if (t.startsWith(q)) return { score: 80, matches: [[0, q.length - 1]] }

  // 3. Contains as substring
  const idx = t.indexOf(q)
  if (idx !== -1) return { score: 60, matches: [[idx, idx + q.length - 1]] }

  // 4. Fuzzy: all chars appear in order
  const positions: number[] = []
  let qi = 0
  let totalGap = 0
  let lastIdx = -1

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      positions.push(ti)
      if (lastIdx !== -1) totalGap += ti - lastIdx - 1
      lastIdx = ti
      qi++
    }
  }

  if (qi < q.length) return { score: -1, matches: [] }

  const matches: Array<[number, number]> = []
  let start = positions[0]
  let prev = positions[0]
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] === prev + 1) {
      prev = positions[i]
    } else {
      matches.push([start, prev])
      start = positions[i]
      prev = positions[i]
    }
  }
  matches.push([start, prev])

  const penalty = totalGap / (text.length || 1)
  return { score: Math.max(1, 40 - penalty * 20), matches }
}

function isCommandAvailable(command: Command): boolean {
  if (command.disabled) return false
  if (command.enabled && !command.enabled()) return false
  return true
}

export function fuzzySearch(query: string, commands: Command[]): SearchResult[] {
  if (!query.trim()) return []

  const results: SearchResult[] = []

  for (const command of commands) {
    if (!isCommandAvailable(command)) continue

    let best = scoreMatch(query, command.label)

    for (const kw of command.keywords ?? []) {
      const s = scoreMatch(query, kw)
      if (s.score > best.score) best = { score: s.score, matches: [] }
    }

    // Aliases score same as prefix match (80) if exact, otherwise as keywords
    for (const alias of command.aliases ?? []) {
      const s = scoreMatch(query, alias)
      if (s.score > best.score) best = { score: s.score, matches: [] }
    }

    if (best.score > 0) {
      results.push({ command, score: best.score, matches: best.matches })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

export function highlightMatches(label: string, matches: Array<[number, number]>): VNode {
  if (!matches.length) return h('span', label)

  const parts: VNode[] = []
  let cursor = 0

  for (const [start, end] of matches) {
    if (cursor < start) parts.push(h('span', label.slice(cursor, start)))
    parts.push(h('mark', { class: 'vcp-match' }, label.slice(start, end + 1)))
    cursor = end + 1
  }

  if (cursor < label.length) parts.push(h('span', label.slice(cursor)))

  return h('span', parts)
}
