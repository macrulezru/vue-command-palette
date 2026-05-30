import { describe, expect, it } from 'vitest'
import type { VNode } from 'vue'
import { fuzzySearch, getMatchRanges, highlightMatches } from './FuzzySearch'
import type { Command } from '../types'

function cmd(id: string, label: string, extra: Partial<Command> = {}): Command {
  return { id, label, perform: () => {}, ...extra }
}

describe('fuzzySearch', () => {
  it('returns empty array for empty query', () => {
    expect(fuzzySearch('', [cmd('a', 'Alpha')])).toEqual([])
    expect(fuzzySearch('   ', [cmd('a', 'Alpha')])).toEqual([])
  })

  it('exact match scores 100', () => {
    const results = fuzzySearch('git status', [cmd('gs', 'git status')])
    expect(results[0].score).toBe(100)
  })

  it('prefix match scores 80', () => {
    const results = fuzzySearch('git', [cmd('gs', 'git status')])
    expect(results[0].score).toBe(80)
  })

  it('substring match scores 60', () => {
    const results = fuzzySearch('status', [cmd('gs', 'git status')])
    expect(results[0].score).toBe(60)
  })

  it('fuzzy match scores between 1 and 40 — gts matches Git status', () => {
    const results = fuzzySearch('gts', [cmd('gs', 'Git status')])
    expect(results.length).toBe(1)
    expect(results[0].score).toBeGreaterThan(0)
    expect(results[0].score).toBeLessThanOrEqual(40)
  })

  it('excludes commands where chars do not appear in order', () => {
    expect(fuzzySearch('xyz', [cmd('a', 'Alpha')])).toHaveLength(0)
  })

  it('ranks exact > prefix > substring', () => {
    const commands = [
      cmd('c', 'open file'),
      cmd('b', 'open'),
      cmd('a', 'open recent files'),
    ]
    const results = fuzzySearch('open', commands)
    expect(results[0].command.id).toBe('b')
    expect(results[1].command.id).toBe('c')
    expect(results[2].command.id).toBe('a')
  })

  it('skips disabled commands', () => {
    expect(fuzzySearch('alpha', [cmd('a', 'Alpha', { disabled: true })])).toHaveLength(0)
  })

  it('skips commands where enabled() returns false', () => {
    expect(fuzzySearch('alpha', [cmd('a', 'Alpha', { enabled: () => false })])).toHaveLength(0)
  })

  it('includes commands where enabled() returns true', () => {
    expect(fuzzySearch('alpha', [cmd('a', 'Alpha', { enabled: () => true })])).toHaveLength(1)
  })

  it('includes disabled commands (demoted to the end) when includeDisabled is set', () => {
    const cmds = [cmd('a', 'Alpha'), cmd('b', 'Alfa', { disabled: true })]
    // default: disabled excluded
    expect(fuzzySearch('al', cmds).map(r => r.command.id)).toEqual(['a'])
    // includeDisabled: present, but available ones rank first
    const incl = fuzzySearch('al', cmds, true)
    expect(incl.map(r => r.command.id)).toContain('b')
    expect(incl[incl.length - 1].command.id).toBe('b')
  })

  it('searches keywords when label does not match', () => {
    const c = cmd('a', 'Open Settings', { keywords: ['preferences', 'config'] })
    expect(fuzzySearch('config', [c])).toHaveLength(1)
  })

  it('searches aliases', () => {
    const c = cmd('a', 'Preferences', { aliases: ['Settings', 'Options'] })
    const results = fuzzySearch('settings', [c])
    expect(results).toHaveLength(1)
  })

  it('ranks by description when the label does not match (substring)', () => {
    const c = cmd('a', 'Format', { description: 'Run Prettier on the current file' })
    const results = fuzzySearch('prettier', [c])
    expect(results).toHaveLength(1)
  })

  it('reports the matched field and text', () => {
    const byLabel = fuzzySearch('open', [cmd('a', 'Open File')])
    expect(byLabel[0].matchedField).toBe('label')

    const byKeyword = fuzzySearch('config', [cmd('b', 'Settings', { keywords: ['config'] })])
    expect(byKeyword[0].matchedField).toBe('keyword')
    expect(byKeyword[0].matchedText).toBe('config')

    const byAlias = fuzzySearch('prefs', [cmd('c', 'Settings', { aliases: ['prefs'] })])
    expect(byAlias[0].matchedField).toBe('alias')
    expect(byAlias[0].matchedText).toBe('prefs')
  })

  it('does NOT match description via loose subsequence', () => {
    // "error" appears as a subsequence of "Charts, metrics and reports" but not as a substring
    const c = cmd('a', 'Go to Analytics', { description: 'Charts, metrics and reports' })
    expect(fuzzySearch('error', [c])).toHaveLength(0)
  })

  it('keeps label highlight even when an alias produces the winning score', () => {
    // label fuzzy-matches "stns" weakly; alias "Settings" matches exactly (higher score)
    const c = cmd('a', 'Settings', { aliases: ['Preferences'] })
    const results = fuzzySearch('preferences', [c])
    // alias wins the score, but label has no match → matches stays empty (not broken)
    expect(results[0].score).toBeGreaterThanOrEqual(80)
    expect(results[0].matches).toEqual([])
  })

  it('keeps label match ranges when label also matches alongside a keyword', () => {
    const c = cmd('a', 'Open File', { keywords: ['document'] })
    const results = fuzzySearch('open', [c])
    expect(results[0].matches).toEqual([[0, 3]])
  })

  it('alias exact match scores at least 80', () => {
    const c = cmd('a', 'Preferences', { aliases: ['Settings'] })
    const results = fuzzySearch('settings', [c])
    expect(results[0].score).toBeGreaterThanOrEqual(80)
  })

  it('returns match positions for highlighting', () => {
    const results = fuzzySearch('open', [cmd('a', 'open file')])
    expect(results[0].matches).toEqual([[0, 3]])
  })

  it('case-insensitive matching', () => {
    expect(fuzzySearch('GIT', [cmd('a', 'git status')])).toHaveLength(1)
  })

  it('normalizes diacritics — resume matches résumé', () => {
    const results = fuzzySearch('resume', [cmd('a', 'résumé')])
    expect(results).toHaveLength(1)
  })

  it('normalizes diacritics — query with diacritic matches plain label', () => {
    expect(fuzzySearch('résumé', [cmd('a', 'resume')])).toHaveLength(1)
  })

  it('maps highlight ranges back to original indices for decomposed labels', () => {
    // "Café" written as e + combining acute accent → normalized length differs
    const label = 'Café'
    const results = fuzzySearch('cafe', [cmd('a', label)])
    // slicing the original label with the inclusive range covers the whole grapheme
    const [start, end] = results[0].matches[0]
    expect(label.slice(start, end + 1)).toBe(label)
  })

  it('keeps highlight ranges aligned after a leading diacritic char', () => {
    // base "e" + combining accent, then "dit" → query "dit" must highlight d-i-t
    const label = 'édit'
    const results = fuzzySearch('dit', [cmd('a', label)])
    const [start, end] = results[0].matches[0]
    expect(label.slice(start, end + 1)).toBe('dit')
  })
})

describe('getMatchRanges', () => {
  it('returns highlight ranges for a match', () => {
    expect(getMatchRanges('al', 'Alan Turing')).toEqual([[0, 1]])
  })

  it('returns [] when there is no match or empty query', () => {
    expect(getMatchRanges('xyz', 'Alan Turing')).toEqual([])
    expect(getMatchRanges('', 'Alan Turing')).toEqual([])
  })
})

describe('highlightMatches', () => {
  it('returns plain span when no matches', () => {
    const vnode = highlightMatches('hello', [])
    expect(vnode.type).toBe('span')
  })

  it('wraps matched range in mark.vcp-match', () => {
    const vnode = highlightMatches('hello world', [[0, 4]])
    const children = vnode.children as VNode[]
    expect(children[0].type).toBe('mark')
    expect((children[0].props as { class: string }).class).toBe('vcp-match')
  })

  it('produces text after match', () => {
    const vnode = highlightMatches('hello world', [[0, 4]])
    const children = vnode.children as VNode[]
    expect(children[1].children).toBe(' world')
  })

  it('handles multiple match ranges', () => {
    const vnode = highlightMatches('git status', [[0, 2], [4, 9]])
    const children = vnode.children as VNode[]
    expect(children.filter((c) => c.type === 'mark')).toHaveLength(2)
  })
})
