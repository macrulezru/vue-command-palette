// @ts-nocheck — #imports is only available inside a real Nuxt app
import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import { VCommandPalettePlugin } from '../../plugin'
import type { PaletteOptions } from '../../types'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const options = (config.public as Record<string, unknown>).vCommandPalette as
    | PaletteOptions
    | undefined

  nuxtApp.vueApp.use(VCommandPalettePlugin, options ?? {})
})
