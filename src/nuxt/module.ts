// @ts-nocheck — @nuxt/kit's Nuxt/ModuleSetupInstallResult generics aren't
// resolved by this package's standalone (non-Nuxt-app) TS program
import { defineNuxtModule, addPlugin, addImports, addComponent, createResolver } from '@nuxt/kit'
import type { PaletteOptions } from '../types'

export type ModuleOptions = PaletteOptions

// Function-valued PaletteOptions keys — these never survive nuxt.config.ts's
// `vCommandPalette: {...}` -> runtimeConfig.public -> client hydration path.
// SSR (same Node process, no serialization) sees the real function; the
// client only ever gets whatever Nuxt's payload (de)serialization can carry
// across, which never includes functions — so these used to silently work
// on the server and silently vanish on the client, a real SSR/hydration
// mismatch, not just a "missing feature".
const FUNCTION_OPTION_KEYS = [
  'search',
  'onSearch',
  'onOpen',
  'onClose',
  'onError',
  'onHighlight',
] as const

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@macrulez/vue-command-palette',
    configKey: 'vCommandPalette',
    compatibility: { nuxt: '>=3.0.0' },
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    const functionKeysSet = FUNCTION_OPTION_KEYS.filter((key) => options[key] !== undefined)
    if (functionKeysSet.length) {
      console.warn(
        `[@macrulez/vue-command-palette] nuxt.config's "vCommandPalette" option has ${functionKeysSet
          .map((k) => `"${k}"`)
          .join(', ')} set, but function-valued options can't be passed through ` +
          'nuxt.config.ts — they would work during SSR and silently stop working after client ' +
          'hydration. Set these in a Nuxt plugin instead, e.g.:\n' +
          '  export default defineNuxtPlugin((nuxtApp) => {\n' +
          '    nuxtApp.vueApp.use(VCommandPalettePlugin, { onOpen: () => {...} })\n' +
          '  })',
      )
    }

    // Only the JSON-serializable subset is written through — the function
    // fields above are dropped here rather than left for Nuxt's own payload
    // serialization to silently lose, so server and client see the exact
    // same (absent) value instead of disagreeing across hydration.
    const serializableOptions: Record<string, unknown> = { ...options }
    for (const key of FUNCTION_OPTION_KEYS) delete serializableOptions[key]

    nuxt.options.runtimeConfig.public.vCommandPalette = {
      ...(nuxt.options.runtimeConfig.public.vCommandPalette as Record<string, unknown> | undefined),
      ...serializableOptions,
    }

    addPlugin(resolver.resolve('./runtime/plugin'))

    addImports([
      { name: 'useCommandPalette', from: '@macrulez/vue-command-palette' },
      { name: 'useRegisterCommands', from: '@macrulez/vue-command-palette' },
      { name: 'useRegisterGroup', from: '@macrulez/vue-command-palette' },
      { name: 'resolvePaletteContext', from: '@macrulez/vue-command-palette' },
      { name: 'createCommandPalette', from: '@macrulez/vue-command-palette' },
      { name: 'installPalette', from: '@macrulez/vue-command-palette' },
      { name: 'createCommandStore', from: '@macrulez/vue-command-palette' },
      { name: 'createKeyboardManager', from: '@macrulez/vue-command-palette' },
      { name: 'fuzzySearch', from: '@macrulez/vue-command-palette' },
      { name: 'highlightMatches', from: '@macrulez/vue-command-palette' },
      { name: 'getMatchRanges', from: '@macrulez/vue-command-palette' },
    ])

    for (const name of ['CommandPalette', 'CommandItem', 'CommandGroup', 'VirtualList']) {
      addComponent({ name, export: name, filePath: '@macrulez/vue-command-palette' })
    }

    nuxt.options.css.push('@macrulez/vue-command-palette/style.css')
  },
})
