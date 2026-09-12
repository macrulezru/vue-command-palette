// @ts-nocheck — @nuxt/kit's Nuxt/ModuleSetupInstallResult generics aren't
// resolved by this package's standalone (non-Nuxt-app) TS program
import {
  defineNuxtModule,
  addPlugin,
  addImports,
  addComponent,
  addTemplate,
  createResolver,
} from '@nuxt/kit'
import type { PaletteOptions } from '../types'

export type ModuleOptions = PaletteOptions & {
  /**
   * Path to a module that default-exports the function-valued options
   * (`search`, `onSearch`, `onOpen`, `onClose`, `onError`, `onHighlight`) —
   * resolved exactly as written, so use an alias (e.g. `~/palette.config`)
   * or a path relative to the project root. Required to set any of these
   * under Nuxt: they can't survive nuxt.config.ts's JSON serialization into
   * runtimeConfig.public (see FUNCTION_OPTION_KEYS below), so they're wired
   * in as a real ESM import via a generated template instead. Omit if you
   * don't need any of them.
   */
  configFile?: string
}

export const functionalOptionsTemplateFilename = 'vue-command-palette-functional-options.mjs'

// Function-valued PaletteOptions keys — these never survive nuxt.config.ts's
// `vCommandPalette: {...}` -> runtimeConfig.public -> client hydration path.
// SSR (same Node process, no serialization) sees the real function; the
// client only ever gets whatever Nuxt's payload (de)serialization can carry
// across, which never includes functions — so these used to silently work
// on the server and silently vanish on the client, a real SSR/hydration
// mismatch, not just a "missing feature". `configFile` (below) is the real
// fix; dropping them here just keeps server/client consistent regardless.
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
          'hydration, and are dropped here. Set "configFile" instead, pointing at a module that ' +
          'default-exports these functions, e.g.:\n' +
          '  // nuxt.config.ts\n' +
          "  vCommandPalette: { configFile: '~/palette.config' }\n" +
          '  // palette.config.ts\n' +
          '  export default { onOpen: () => {...} }',
      )
    }

    addTemplate({
      filename: functionalOptionsTemplateFilename,
      getContents: () =>
        options.configFile
          ? `export { default as functionalOptions } from ${JSON.stringify(options.configFile)}`
          : `export const functionalOptions = {}`,
    })

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
