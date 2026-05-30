import { h, type VNode } from 'vue'
import type { Command, SearchResult } from '../types'

function normalize(str: string): string {
  return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/**
 * Normalizes a string while tracking where each normalized character came from
 * in the original string. NFD decomposition + diacritic stripping can change a
 * character's length (e.g. `é` → `e`), so highlight ranges computed in the
 * normalized space must be mapped back to the original indices.
 *
 * `map[k]` is the original index of the source code point of normalized char `k`;
 * `map[normalized.length]` is a sentinel equal to `str.length`.
 */
function normalizeWithMap(str: string): { normalized: string; map: number[] } {
  const out: string[] = []
  const map: number[] = []
  let i = 0
  for (const ch of str) {
    const start = i
    i += ch.length
    const n = ch.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    for (const c of n) {
      out.push(c)
      map.push(start)
    }
  }
  map.push(str.length)
  return { normalized: out.join(''), map }
}

/** Translates inclusive ranges from normalized-string space to original-string space. */
function translateMatches(matches: Array<[number, number]>, map: number[]): Array<[number, number]> {
  return matches.map(([s, e]) => [map[s], map[e + 1] - 1] as [number, number])
}

function scoreMatch(query: string, text: string): { score: number; matches: Array<[number, number]> } {
  const q = normalize(query)
  const { normalized: t, map } = normalizeWithMap(text)

  if (!q) return { score: 0, matches: [] }

  // 1. Exact match
  if (t === q) return { score: 100, matches: [[0, text.length - 1]] }

  // 2. Prefix match
  if (t.startsWith(q)) return { score: 80, matches: translateMatches([[0, q.length - 1]], map) }

  // 3. Contains as substring
  const idx = t.indexOf(q)
  if (idx !== -1) return { score: 60, matches: translateMatches([[idx, idx + q.length - 1]], map) }

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
  return { score: Math.max(1, 40 - penalty * 20), matches: translateMatches(matches, map) }
}

function isCommandAvailable(command: Command): boolean {
  if (command.disabled) return false
  if (command.enabled && !command.enabled()) return false
  return true
}

export function fuzzySearch<T = unknown>(
  query: string,
  commands: Command<T>[],
  includeDisabled = false,
): SearchResult<T>[] {
  if (!query.trim()) return []

  const results: SearchResult<T>[] = []

  for (const command of commands) {
    if (!isCommandAvailable(command) && !includeDisabled) continue

    // The label is the only field rendered, so highlight ranges always come from
    // it — even when another field produces the winning score.
    const labelMatch = scoreMatch(query, command.label)
    let best = labelMatch.score
    let matchedField: SearchResult['matchedField'] = 'label'
    let matchedText: string | undefined

    // Description is matched only as a substring (or better), never as a loose
    // fuzzy subsequence — long sentences would otherwise produce false positives.
    if (command.description) {
      const s = scoreMatch(query, command.description)
      if (s.score >= 60 && s.score > best) { best = s.score; matchedField = 'description' }
    }

    for (const kw of command.keywords ?? []) {
      const s = scoreMatch(query, kw)
      if (s.score > best) { best = s.score; matchedField = 'keyword'; matchedText = kw }
    }

    for (const alias of command.aliases ?? []) {
      const s = scoreMatch(query, alias)
      if (s.score > best) { best = s.score; matchedField = 'alias'; matchedText = alias }
    }

    if (best > 0) {
      results.push({
        command,
        score: best,
        matches: labelMatch.score > 0 ? labelMatch.matches : [],
        matchedField,
        matchedText,
      })
    }
  }

  // When including disabled commands, keep available ones first; then by relevance.
  return results.sort((a, b) => {
    if (includeDisabled) {
      const av = isCommandAvailable(a.command) ? 1 : 0
      const bv = isCommandAvailable(b.command) ? 1 : 0
      if (av !== bv) return bv - av
    }
    return compareByRelevance(a, b)
  })
}

/**
 * Result ordering: a match in the command **name** (non-empty `matches`) always
 * outranks a match found only in description/keywords/aliases; within a tier, by score.
 * Kept as a shared comparator so frecency re-sorting and async merging stay consistent.
 */
export function compareByRelevance(a: SearchResult, b: SearchResult): number {
  const aLabel = a.matches.length ? 1 : 0
  const bLabel = b.matches.length ? 1 : 0
  if (aLabel !== bLabel) return bLabel - aLabel
  return b.score - a.score
}

/**
 * Highlight ranges for `query` within `text`, in original-string indices.
 * Returns `[]` when there is no match. Useful for highlighting results that came
 * from an external source (async groups, pages, modes) rather than `fuzzySearch`.
 */
export function getMatchRanges(query: string, text: string): Array<[number, number]> {
  const r = scoreMatch(query, text)
  return r.score > 0 ? r.matches : []
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
