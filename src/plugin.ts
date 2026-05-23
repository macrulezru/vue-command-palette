import { computed, ref, type App } from 'vue'
import { createCommandStore } from './core/CommandStore'
import { createKeyboardManager } from './core/KeyboardManager'
import { PALETTE_INJECT_KEY } from './types'
import type { PaletteOptions } from './types'
import type { PaletteContext } from './core/useCommandPalette'

export const VCommandPalettePlugin = {
  install(app: App, options: PaletteOptions = {}) {
    const {
      hotkey = ['$mod', 'k'],
      persistRecent = true,
      maxRecent = 5,
      maxRecentPerGroup = 0,
      localStorageKey = 'vcp:recent',
      onOpen,
      onClose,
      onError,
    } = options

    const store = createCommandStore()
    const keyboard = createKeyboardManager()

    const isOpen = ref(false)
    const query = ref('')
    const activeIndex = ref(0)
    const history = ref<Array<{ paletteId: string; query: string; activeIndex: number }>>([])
    const loadingCommandId = ref<string | null>(null)

    let storedRecent: string[] = []
    if (persistRecent && typeof localStorage !== 'undefined') {
      try {
        storedRecent = JSON.parse(localStorage.getItem(localStorageKey) ?? '[]')
      } catch {}
    }
    const recentIds = ref<string[]>(storedRecent)

    const results = computed(() => store.search(query.value))

    const ctx: PaletteContext = {
      store,
      keyboard,
      isOpen,
      query,
      activeIndex,
      history,
      recentIds,
      loadingCommandId,
      results,
      persistRecent,
      maxRecent,
      maxRecentPerGroup: maxRecentPerGroup ?? 0,
      localStorageKey,
      onOpen,
      onClose,
      onError,
    }

    app.provide(PALETTE_INJECT_KEY, ctx)

    keyboard.registerShortcut(hotkey, () => {
      isOpen.value = !isOpen.value
      if (isOpen.value) {
        query.value = ''
        activeIndex.value = 0
        onOpen?.()
      } else {
        onClose?.()
      }
    })

    keyboard.start()

    const originalUnmount = app.unmount.bind(app)
    app.unmount = () => {
      keyboard.stop()
      originalUnmount()
    }
  },
}
