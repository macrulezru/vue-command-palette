// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, type App } from 'vue'
import { PALETTE_INJECT_KEY } from '../types'
import { createPaletteContext } from '../testing'
import { useCommandPalette } from './useCommandPalette'
import type { Command } from '../types'
import type { PaletteTestOptions } from '../testing'

function cmd(id: string, label: string, extra: Partial<Command> = {}): Command {
  return { id, label, perform: () => {}, ...extra }
}

/** Minimal in-memory Storage — the test environment's global localStorage is unreliable. */
function makeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    clear: () => { m.clear() },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size },
  } as Storage
}

/** Mount a throwaway app so inject() works, then run the composable in its context. */
function setup(options: PaletteTestOptions = {}) {
  const { ctx } = createPaletteContext(options)
  const app: App = createApp({ render: () => null })
  app.provide(PALETTE_INJECT_KEY, ctx)
  const palette = app.runWithContext(() => useCommandPalette())
  return { palette, ctx, app }
}

describe('useCommandPalette', () => {
  let storage: Storage

  beforeEach(() => {
    storage = makeStorage()
    vi.stubGlobal('localStorage', storage)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('open / close / toggle drive isOpen', () => {
    const { palette, ctx } = setup()
    expect(ctx.isOpen.value).toBe(false)
    palette.open()
    expect(ctx.isOpen.value).toBe(true)
    palette.close()
    expect(ctx.isOpen.value).toBe(false)
    palette.toggle()
    expect(ctx.isOpen.value).toBe(true)
  })

  it('open(paletteId) while open pushes onto history', () => {
    const { palette, ctx } = setup()
    palette.open()
    palette.open('parent')
    expect(ctx.history.value).toHaveLength(1)
    expect(ctx.history.value[0].paletteId).toBe('parent')
  })

  it('goBack pops history, then closes when empty', () => {
    const { palette, ctx } = setup()
    palette.open()
    palette.open('parent')
    palette.goBack()
    expect(ctx.history.value).toHaveLength(0)
    expect(ctx.isOpen.value).toBe(true)
    palette.goBack()
    expect(ctx.isOpen.value).toBe(false)
  })

  it('tracks recent in memory even when persistRecent is false', () => {
    const { palette, ctx } = setup({ persistRecent: false })
    palette.addRecent('a')
    palette.addRecent('b')
    expect(ctx.recentIds.value).toEqual(['b', 'a'])
  })

  it('does not write to localStorage when persistRecent is false', () => {
    const setItem = vi.spyOn(storage, 'setItem')
    const { palette } = setup({ persistRecent: false })
    palette.addRecent('a')
    expect(setItem).not.toHaveBeenCalled()
  })

  it('persists recent to localStorage when enabled', () => {
    const { palette } = setup({ persistRecent: true, localStorageKey: 'k' })
    palette.addRecent('a')
    expect(JSON.parse(storage.getItem('k')!)).toEqual(['a'])
  })

  it('addRecent dedupes and respects maxRecent', () => {
    const { palette, ctx } = setup({ maxRecent: 2 })
    palette.addRecent('a')
    palette.addRecent('b')
    palette.addRecent('a')
    palette.addRecent('c')
    expect(ctx.recentIds.value).toEqual(['c', 'a'])
  })

  it('getRecentCommands resolves ids and drops missing ones', () => {
    const { palette } = setup({ commands: [cmd('a', 'Alpha')] })
    palette.addRecent('a')
    palette.addRecent('ghost')
    expect(palette.getRecentCommands().map(c => c.id)).toEqual(['a'])
  })

  it('getRecentCommands resolves nested sub-commands (executed from a group)', () => {
    const parent = cmd('parent', 'Parent', { subCommands: [cmd('child', 'Child')] })
    const { palette } = setup({ commands: [parent] })
    palette.addRecent('child') // a leaf sub-command, not registered directly
    expect(palette.getRecentCommands().map(c => c.id)).toEqual(['child'])
  })

  it('executeCommand runs perform, records recent and closes', async () => {
    const perform = vi.fn()
    const { palette, ctx } = setup()
    palette.open()
    await palette.executeCommand(cmd('a', 'Alpha', { perform }))
    expect(perform).toHaveBeenCalledOnce()
    expect(ctx.recentIds.value).toContain('a')
    expect(ctx.isOpen.value).toBe(false)
  })

  it('executeCommand opens nested palette for subCommands instead of perform', async () => {
    const perform = vi.fn()
    const parent = cmd('p', 'Parent', { perform, subCommands: [cmd('c', 'Child')] })
    const { palette, ctx } = setup({ commands: [parent] })
    palette.open()
    await palette.executeCommand(parent)
    expect(perform).not.toHaveBeenCalled()
    expect(ctx.history.value[0].paletteId).toBe('p')
  })

  it('executeCommand skips disabled commands', async () => {
    const perform = vi.fn()
    const { palette } = setup()
    await palette.executeCommand(cmd('a', 'Alpha', { perform, disabled: true }))
    expect(perform).not.toHaveBeenCalled()
  })

  it('executeCommand routes errors to onError', async () => {
    const onError = vi.fn()
    const err = new Error('boom')
    const { palette } = setup({ onError })
    await palette.executeCommand(cmd('a', 'Alpha', { perform: () => { throw err } }))
    expect(onError).toHaveBeenCalledWith(err, expect.objectContaining({ id: 'a' }))
  })

  it('executeActive runs the command at activeIndex from currentResults', async () => {
    const perform = vi.fn()
    const { palette, ctx } = setup()
    ctx.currentResults.value = [
      { command: cmd('a', 'Alpha'), score: 1, matches: [] },
      { command: cmd('b', 'Beta', { perform }), score: 1, matches: [] },
    ]
    ctx.activeIndex.value = 1
    await palette.executeActive()
    expect(perform).toHaveBeenCalledOnce()
  })

  it('throws a helpful error when the plugin is not installed', () => {
    const app = createApp({ render: () => null })
    expect(() => app.runWithContext(() => useCommandPalette())).toThrow(/Plugin not installed/)
  })

  it('pin / unpin / togglePin manage pinnedIds', () => {
    const { palette, ctx } = setup({ commands: [cmd('a', 'Alpha')] })
    expect(palette.isPinned('a')).toBe(false)
    palette.pin('a')
    expect(ctx.pinnedIds.value).toEqual(['a'])
    expect(palette.isPinned('a')).toBe(true)
    palette.pin('a') // idempotent
    expect(ctx.pinnedIds.value).toEqual(['a'])
    palette.togglePin('a')
    expect(ctx.pinnedIds.value).toEqual([])
  })

  it('getPinnedCommands resolves ids to commands', () => {
    const { palette } = setup({ commands: [cmd('a', 'Alpha')] })
    palette.pin('a')
    palette.pin('ghost')
    expect(palette.getPinnedCommands().map(c => c.id)).toEqual(['a'])
  })

  it('records the query into history on execute (most-recent-first, deduped)', async () => {
    const { palette, ctx } = setup({ commands: [cmd('a', 'Alpha')] })
    palette.open()
    ctx.query.value = 'first'
    await palette.executeCommand(cmd('a', 'Alpha'))
    palette.open()
    ctx.query.value = 'second'
    await palette.executeCommand(cmd('a', 'Alpha'))
    palette.open()
    ctx.query.value = 'first'
    await palette.executeCommand(cmd('a', 'Alpha'))
    expect(ctx.queryHistory.value).toEqual(['first', 'second'])
  })
})
