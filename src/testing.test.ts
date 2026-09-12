// @vitest-environment jsdom
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { PaletteProvider, createPaletteContext } from './testing'
import { useCommandPalette } from './core/useCommandPalette'
import type { Command } from './types'

function cmd(id: string, label: string, extra: Partial<Command> = {}): Command {
  return { id, label, perform: () => {}, ...extra }
}

describe('createPaletteContext', () => {
  it('returns a registry containing the default instance', () => {
    const { registry, ctx } = createPaletteContext()
    expect(registry.get('default')).toBe(ctx)
  })
})

describe('PaletteProvider', () => {
  it('provides both the singleton and the registry — named-instance lookups resolve under it', () => {
    // Regression: PaletteProvider used to only vueProvide() the singleton
    // key, even though createPaletteContext() (which it builds on) already
    // returns a registry too — useCommandPalette('default') (name-based
    // lookup) failed under PaletteProvider even though the unnamed
    // useCommandPalette() worked fine.
    let resolvedViaName: ReturnType<typeof useCommandPalette> | undefined
    let resolvedViaDefault: ReturnType<typeof useCommandPalette> | undefined

    const Consumer = defineComponent({
      setup() {
        resolvedViaName = useCommandPalette('default')
        resolvedViaDefault = useCommandPalette()
        return () => h('div')
      },
    })

    mount(PaletteProvider, {
      props: { commands: [cmd('a', 'Alpha')] },
      slots: { default: () => h(Consumer) },
    })

    expect(resolvedViaName).toBeDefined()
    expect(resolvedViaDefault).toBeDefined()
  })
})
