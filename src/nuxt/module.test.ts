import { describe, it, expect, vi, beforeEach } from 'vitest'

const { addComponentMock, addImportsMock, addPluginMock } = vi.hoisted(() => ({
  addComponentMock: vi.fn(),
  addImportsMock: vi.fn(),
  addPluginMock: vi.fn(),
}))

// Real @nuxt/kit needs a full Nuxt instance to call defineNuxtModule() —
// mocked here so the module's own setup() logic can be exercised directly,
// without pulling in @nuxt/test-utils' full app-building machinery.
vi.mock('@nuxt/kit', () => ({
  defineNuxtModule: (def: unknown) => def,
  addPlugin: (...args: unknown[]) => addPluginMock(...args),
  addImports: (...args: unknown[]) => addImportsMock(...args),
  addComponent: (...args: unknown[]) => addComponentMock(...args),
  createResolver: () => ({ resolve: (p: string) => p }),
}))

import moduleDef from './module'

interface FakeNuxt {
  options: {
    runtimeConfig: { public: Record<string, unknown> }
    css: string[]
  }
}

function fakeNuxt(): FakeNuxt {
  return { options: { runtimeConfig: { public: {} }, css: [] } }
}

function runSetup(options: Record<string, unknown>, nuxt: FakeNuxt) {
  ;(moduleDef as unknown as { setup: (o: unknown, n: unknown) => void }).setup(options, nuxt)
}

describe('Nuxt module', () => {
  beforeEach(() => {
    addComponentMock.mockClear()
    addImportsMock.mockClear()
    addPluginMock.mockClear()
  })

  it('registers every public component via addComponent, not zero', () => {
    runSetup({}, fakeNuxt())
    const names = addComponentMock.mock.calls.map(([opts]) => (opts as { name: string }).name)
    expect(names).toEqual(
      expect.arrayContaining(['CommandPalette', 'CommandItem', 'CommandGroup', 'VirtualList']),
    )
  })

  it('auto-imports every public composable/factory, not just 3', () => {
    runSetup({}, fakeNuxt())
    const imported = (addImportsMock.mock.calls[0][0] as Array<{ name: string }>).map((i) => i.name)
    for (const name of [
      'useCommandPalette',
      'useRegisterCommands',
      'useRegisterGroup',
      'resolvePaletteContext',
      'createCommandPalette',
      'installPalette',
      'createCommandStore',
      'createKeyboardManager',
      'fuzzySearch',
      'highlightMatches',
      'getMatchRanges',
    ]) {
      expect(imported).toContain(name)
    }
  })

  it('strips function-valued options before writing to runtimeConfig.public, and warns', () => {
    const nuxt = fakeNuxt()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    runSetup({ hotkey: ['$mod', 'k'], onOpen: () => {}, search: () => [] }, nuxt)
    const written = nuxt.options.runtimeConfig.public.vCommandPalette as Record<string, unknown>
    expect(written.hotkey).toEqual(['$mod', 'k'])
    expect(written.onOpen).toBeUndefined()
    expect(written.search).toBeUndefined()
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toMatch(/onOpen/)
    warnSpy.mockRestore()
  })

  it('does not warn when no function-valued option is set', () => {
    const nuxt = fakeNuxt()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    runSetup({ hotkey: ['$mod', 'k'], maxRecent: 10 }, nuxt)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
