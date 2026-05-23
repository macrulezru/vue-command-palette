import { describe, expect, it } from 'vitest'
import { fuzzySearch, highlightMatches } from './FuzzySearch'
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

  it('searches keywords when label does not match', () => {
    const c = cmd('a', 'Open Settings', { keywords: ['preferences', 'config'] })
    expect(fuzzySearch('config', [c])).toHaveLength(1)
  })

  it('searches aliases', () => {
    const c = cmd('a', 'Preferences', { aliases: ['Settings', 'Options'] })
    const results = fuzzySearch('settings', [c])
    expect(results).toHaveLength(1)
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
})

describe('highlightMatches', () => {
  it('returns plain span when no matches', () => {
    const vnode = highlightMatches('hello', [])
    expect(vnode.type).toBe('span')
  })

  it('wraps matched range in mark.vcp-match', () => {
    const vnode = highlightMatches('hello world', [[0, 4]])
    const children = vnode.children as any[]
    expect(children[0].type).toBe('mark')
    expect(children[0].props.class).toBe('vcp-match')
  })

  it('produces text after match', () => {
    const vnode = highlightMatches('hello world', [[0, 4]])
    const children = vnode.children as any[]
    expect(children[1].children).toBe(' world')
  })

  it('handles multiple match ranges', () => {
    const vnode = highlightMatches('git status', [[0, 2], [4, 9]])
    const children = vnode.children as any[]
    expect(children.filter((c: any) => c.type === 'mark')).toHaveLength(2)
  })
})
