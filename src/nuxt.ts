// @ts-nocheck — #app alias is only available inside a Nuxt project
import { defineNuxtPlugin } from '#app'
import { VCommandPalettePlugin } from './plugin'
import type { PaletteOptions } from './types'

export default defineNuxtPlugin((nuxtApp) => {
  const options: PaletteOptions = {
    // Nuxt рантайм-конфиг может передать опции через nuxtApp.$config
    ...(nuxtApp.$config?.public?.vCommandPalette ?? {}),
  }
  nuxtApp.vueApp.use(VCommandPalettePlugin, options)
})
