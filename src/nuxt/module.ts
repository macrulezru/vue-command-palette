// @ts-nocheck — @nuxt/kit's Nuxt/ModuleSetupInstallResult generics aren't
// resolved by this package's standalone (non-Nuxt-app) TS program
import { defineNuxtModule, addPlugin, addImports, createResolver } from '@nuxt/kit'
import type { PaletteOptions } from '../types'

export type ModuleOptions = PaletteOptions

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@macrulez/vue-command-palette',
    configKey: 'vCommandPalette',
    compatibility: { nuxt: '>=3.0.0' },
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    nuxt.options.runtimeConfig.public.vCommandPalette = {
      ...(nuxt.options.runtimeConfig.public.vCommandPalette as Record<string, unknown> | undefined),
      ...options,
    }

    addPlugin(resolver.resolve('./runtime/plugin'))

    addImports([
      { name: 'useCommandPalette', from: '@macrulez/vue-command-palette' },
      { name: 'useRegisterCommands', from: '@macrulez/vue-command-palette' },
      { name: 'useRegisterGroup', from: '@macrulez/vue-command-palette' },
    ])

    nuxt.options.css.push('@macrulez/vue-command-palette/style.css')
  },
})
