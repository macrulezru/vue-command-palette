import { computed, inject, ref, watch, type App } from 'vue'
import { createCommandStore } from './core/CommandStore'
import { createKeyboardManager } from './core/KeyboardManager'
import { PALETTE_INJECT_KEY, PALETTE_REGISTRY_KEY } from './types'
import type { Command, CommandUsage, PaletteOptions, SearchResult } from './types'
import type { PaletteContext } from './core/useCommandPalette'

/** Frecency bonus: combines frequency (count) with recency (decays over ~30 days). */
function frecencyBonus(stat: CommandUsage | undefined, now = Date.now()): number {
  if (!stat) return 0
  const ageDays = (now - stat.lastUsed) / 86_400_000
  const recency = Math.max(0, 1 - ageDays / 30)
  return stat.count * 2 + recency * 15
}

export function installPalette(app: App, options: PaletteOptions = {}) {
  {
    const {
      name = 'default',
      hotkey = ['$mod', 'k'],
      persistRecent = true,
      maxRecent = 5,
      maxRecentPerGroup = 0,
      localStorageKey = 'vcp:recent',
      colorTheme: initialColorTheme = 'system',
      search,
      searchNested = true,
      showDisabled = false,
      frecency = false,
      onSearch: globalSearch,
      bindShortcuts = false,
      onOpen,
      onClose,
      onError,
      onHighlight,
    } = options

    // Frecency: per-command usage stats + bonus applied inside store.search.
    let storedUsage: Record<string, CommandUsage> = {}
    if (frecency && persistRecent && typeof localStorage !== 'undefined') {
      try {
        storedUsage = JSON.parse(localStorage.getItem(localStorageKey + ':frecency') ?? '{}')
      } catch {
        // ignore malformed / unavailable storage
      }
    }
    const usage = ref<Record<string, CommandUsage>>(storedUsage)

    const scoreBonus = frecency
      ? (command: Command) => frecencyBonus(usage.value[command.id])
      : undefined

    const store = createCommandStore(search, searchNested, scoreBonus, showDisabled)
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
      } catch {
        // ignore malformed / unavailable storage
      }
    }
    const recentIds = ref<string[]>(storedRecent)

    let storedPinned: string[] = []
    if (persistRecent && typeof localStorage !== 'undefined') {
      try {
        storedPinned = JSON.parse(localStorage.getItem(localStorageKey + ':pinned') ?? '[]')
      } catch {
        // ignore malformed / unavailable storage
      }
    }
    const pinnedIds = ref<string[]>(storedPinned)
    const queryHistory = ref<string[]>([])

    const results = computed(() => store.search(query.value))
    const currentResults = ref<SearchResult[]>([])
    const executeRequest = ref<((cmd: Command) => void) | null>(null)
    const colorTheme = ref<'light' | 'dark' | 'system'>(initialColorTheme)

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
      currentResults,
      executeRequest,
      colorTheme,
      persistRecent,
      maxRecent,
      maxRecentPerGroup: maxRecentPerGroup ?? 0,
      localStorageKey,
      frecency,
      usage,
      pinnedIds,
      queryHistory,
      showDisabled,
      globalSearch,
      onOpen,
      onClose,
      onError,
      onHighlight,
    }

    // Register into the named-instance registry (get-or-create), so multiple
    // independent palettes can coexist on one app.
    const registry =
      app.runWithContext(() => inject<Map<string, PaletteContext> | null>(PALETTE_REGISTRY_KEY, null)) ??
      new Map<string, PaletteContext>()
    registry.set(name, ctx)
    app.provide(PALETTE_REGISTRY_KEY, registry)

    // The default instance (or the first installed) also occupies the singleton
    // key, so `useCommandPalette()` / `inject(PALETTE_INJECT_KEY)` keep working.
    const existingDefault = app.runWithContext(() => inject<PaletteContext | null>(PALETTE_INJECT_KEY, null))
    if (name === 'default' || !existingDefault) {
      app.provide(PALETTE_INJECT_KEY, ctx)
    }

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

    // Auto-register command shortcuts as real global hotkeys.
    if (bindShortcuts) {
      // Minimal execution used only when no CommandPalette is mounted.
      async function runFallback(cmd: Command) {
        if (cmd.disabled || (cmd.enabled && !cmd.enabled())) return
        if (cmd.subCommands?.length) { isOpen.value = true; return }
        loadingCommandId.value = cmd.id
        try {
          await cmd.perform()
        } catch (err) {
          if (onError) onError(err, cmd)
          else console.error('[@macrulez/vue-command-palette] Command error:', err)
        } finally {
          loadingCommandId.value = null
        }
      }

      const bound = new Map<string, () => void>()
      watch(
        () => Array.from(store.state.commands.values()),
        (cmds) => {
          const ids = new Set(cmds.map(c => c.id))
          for (const [id, unregister] of bound) {
            if (!ids.has(id)) { unregister(); bound.delete(id) }
          }
          for (const cmd of cmds) {
            if (cmd.shortcut?.length && !bound.has(cmd.id)) {
              const unregister = keyboard.registerShortcut(cmd.shortcut, () => {
                const handler = executeRequest.value
                if (handler) handler(cmd)
                else void runFallback(cmd)
              })
              bound.set(cmd.id, unregister)
            }
          }
        },
        { immediate: true },
      )
    }

    const originalUnmount = app.unmount.bind(app)
    app.unmount = () => {
      keyboard.stop()
      originalUnmount()
    }
  }
}

/**
 * Default plugin — installs a single (default) palette instance.
 *
 * ```ts
 * app.use(VCommandPalettePlugin, { hotkey: ['$mod', 'k'] })
 * ```
 */
export const VCommandPalettePlugin = {
  install: installPalette,
}

/**
 * Factory for an additional, independently-named palette instance. Each call
 * returns a fresh plugin object, so Vue's `app.use` de-duplication does not
 * skip it — allowing multiple palettes on one app.
 *
 * ```ts
 * app.use(VCommandPalettePlugin)                        // default
 * app.use(createCommandPalette({ name: 'sidebar', hotkey: ['$mod', 'j'] }))
 * ```
 */
export function createCommandPalette(options: PaletteOptions = {}) {
  return {
    install(app: App) {
      installPalette(app, options)
    },
  }
}
