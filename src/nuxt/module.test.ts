import { describe, it, expect, vi, beforeEach } from 'vitest'

const { addComponentMock, addImportsMock, addPluginMock, addTemplateMock } = vi.hoisted(() => ({
  addComponentMock: vi.fn(),
  addImportsMock: vi.fn(),
  addPluginMock: vi.fn(),
  addTemplateMock: vi.fn(),
}))

// Real @nuxt/kit needs a full Nuxt instance to call defineNuxtModule() —
// mocked here so the module's own setup() logic can be exercised directly,
// without pulling in @nuxt/test-utils' full app-building machinery.
vi.mock('@nuxt/kit', () => ({
  defineNuxtModule: (def: unknown) => def,
  addPlugin: (...args: unknown[]) => addPluginMock(...args),
  addImports: (...args: unknown[]) => addImportsMock(...args),
  addComponent: (...args: unknown[]) => addComponentMock(...args),
  addTemplate: (...args: unknown[]) => addTemplateMock(...args),
  createResolver: () => ({ resolve: (p: string) => p }),
}))

import moduleDef, { functionalOptionsTemplateFilename } from './module'

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
    addTemplateMock.mockClear()
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

  it('generates an empty functionalOptions template when no configFile is set', () => {
    // Regression: function-valued options had no real way to reach a Nuxt
    // consumer at all — the previous warning recommended a workaround
    // (calling app.use(VCommandPalettePlugin, ...) a second time) that
    // Vue's app.use() de-duplication silently no-ops, since the module's own
    // runtime plugin already installs that exact same plugin object.
    runSetup({}, fakeNuxt())
    const call = addTemplateMock.mock.calls.find(
      (c) => (c[0] as { filename: string }).filename === functionalOptionsTemplateFilename,
    )
    expect(call).toBeDefined()
    const getContents = (call![0] as { getContents: () => string }).getContents
    expect(getContents()).toBe('export const functionalOptions = {}')
  })

  it('generates a functionalOptions template importing configFile when set', () => {
    runSetup({ configFile: '~/palette.config' }, fakeNuxt())
    const call = addTemplateMock.mock.calls.find(
      (c) => (c[0] as { filename: string }).filename === functionalOptionsTemplateFilename,
    )
    expect(call).toBeDefined()
    const getContents = (call![0] as { getContents: () => string }).getContents
    expect(getContents()).toBe(`export { default as functionalOptions } from "~/palette.config"`)
  })

  it('recommends configFile (not the broken app.use() workaround) in the warning', () => {
    const nuxt = fakeNuxt()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    runSetup({ onOpen: () => {} }, nuxt)
    expect(warnSpy.mock.calls[0][0]).toMatch(/configFile/)
    expect(warnSpy.mock.calls[0][0]).not.toMatch(/VCommandPalettePlugin/)
    warnSpy.mockRestore()
  })
})
