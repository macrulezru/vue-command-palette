// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import { VCommandPalettePlugin, createCommandPalette } from './plugin'
import { useCommandPalette, resolvePaletteContext } from './core/useCommandPalette'
import { PALETTE_INJECT_KEY, PALETTE_REGISTRY_KEY } from './types'
import type { Command } from './types'

function cmd(id: string, label: string, extra: Partial<Command> = {}): Command {
  return { id, label, perform: () => {}, ...extra }
}

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }))
}

describe('VCommandPalettePlugin', () => {
  let app: App

  beforeEach(() => vi.stubGlobal('localStorage', undefined))
  afterEach(() => {
    app?.unmount()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('provides a context resolvable via useCommandPalette', () => {
    app = createApp({ render: () => null })
    app.use(VCommandPalettePlugin)
    const palette = app.runWithContext(() => useCommandPalette())
    expect(palette.isOpen.value).toBe(false)
    palette.toggle()
    expect(palette.isOpen.value).toBe(true)
  })

  it('toggles open on the configured hotkey', () => {
    app = createApp({ render: () => null })
    app.use(VCommandPalettePlugin, { hotkey: ['$mod', 'k'] })
    const ctx = app.runWithContext(() => resolvePaletteContext())
    expect(ctx.isOpen.value).toBe(false)
    fireKey('k', { metaKey: true })
    expect(ctx.isOpen.value).toBe(true)
  })

  describe('bindShortcuts', () => {
    it('runs a command when its shortcut is pressed', async () => {
      app = createApp({ render: () => null })
      app.use(VCommandPalettePlugin, { bindShortcuts: true })
      const ctx = app.runWithContext(() => resolvePaletteContext())
      const perform = vi.fn()
      ctx.store.registerCommands([cmd('save', 'Save', { shortcut: ['$mod', 's'], perform })])
      await nextTick() // let the watcher flush
      fireKey('s', { metaKey: true })
      expect(perform).toHaveBeenCalledOnce()
    })

    it('does not bind shortcuts when the option is off', async () => {
      app = createApp({ render: () => null })
      app.use(VCommandPalettePlugin, { bindShortcuts: false })
      const ctx = app.runWithContext(() => resolvePaletteContext())
      const perform = vi.fn()
      ctx.store.registerCommands([cmd('save', 'Save', { shortcut: ['$mod', 's'], perform })])
      await nextTick()
      fireKey('s', { metaKey: true })
      expect(perform).not.toHaveBeenCalled()
    })

    it('unbinds a shortcut after its command is removed', async () => {
      app = createApp({ render: () => null })
      app.use(VCommandPalettePlugin, { bindShortcuts: true })
      const ctx = app.runWithContext(() => resolvePaletteContext())
      const perform = vi.fn()
      const cleanup = ctx.store.registerCommands([cmd('save', 'Save', { shortcut: ['$mod', 's'], perform })])
      await nextTick()
      cleanup()
      await nextTick()
      fireKey('s', { metaKey: true })
      expect(perform).not.toHaveBeenCalled()
    })
  })

  describe('named instances', () => {
    it('registers multiple independent palettes', () => {
      app = createApp({ render: () => null })
      app.use(VCommandPalettePlugin) // default
      app.use(createCommandPalette({ name: 'sidebar' }))

      const def = app.runWithContext(() => resolvePaletteContext())
      const sidebar = app.runWithContext(() => resolvePaletteContext('sidebar'))
      expect(def).not.toBe(sidebar)

      const provides = (app as unknown as { _context: { provides: Record<symbol, unknown> } })._context.provides
      const registry = provides[PALETTE_REGISTRY_KEY] as Map<string, unknown>
      expect(registry.size).toBe(2)
    })

    it('keeps the default instance under the singleton key', () => {
      app = createApp({ render: () => null })
      app.use(VCommandPalettePlugin)
      app.use(VCommandPalettePlugin, { name: 'sidebar' })
      const provides = (app as unknown as { _context: { provides: Record<symbol, unknown> } })._context.provides
      const singleton = provides[PALETTE_INJECT_KEY]
      const def = app.runWithContext(() => resolvePaletteContext())
      expect(singleton).toBe(def)
    })

    it('throws for an unknown instance name', () => {
      app = createApp({ render: () => null })
      app.use(VCommandPalettePlugin)
      expect(() => app.runWithContext(() => resolvePaletteContext('nope'))).toThrow(/No palette instance named/)
    })
  })
})
