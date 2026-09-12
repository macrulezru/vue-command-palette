import { computed, inject, ref, watch, type App } from 'vue'
import { createCommandStore } from './core/CommandStore'
import { createKeyboardManager } from './core/KeyboardManager'
import { executeCommandOn, toggleOn } from './core/useCommandPalette'
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
      app.runWithContext(() =>
        inject<Map<string, PaletteContext> | null>(PALETTE_REGISTRY_KEY, null),
      ) ?? new Map<string, PaletteContext>()
    registry.set(name, ctx)
    app.provide(PALETTE_REGISTRY_KEY, registry)

    // The default instance (or the first installed) also occupies the singleton
    // key, so `useCommandPalette()` / `inject(PALETTE_INJECT_KEY)` keep working.
    const existingDefault = app.runWithContext(() =>
      inject<PaletteContext | null>(PALETTE_INJECT_KEY, null),
    )
    if (name === 'default' || !existingDefault) {
      app.provide(PALETTE_INJECT_KEY, ctx)
    }

    keyboard.registerShortcut(hotkey, () => toggleOn(ctx))

    keyboard.start()

    // Auto-register command shortcuts as real global hotkeys — including
    // ones nested under a top-level command's `subCommands`, not just
    // top-level commands themselves.
    if (bindShortcuts) {
      // Minimal execution used only when no CommandPalette is mounted —
      // executeCommandOn() is the exact same logic the mounted UI itself
      // uses (open on subCommands/page, confirm-gate, recent/frecency
      // tracking, perform()), so this fallback can't silently drift from it.
      async function runFallback(cmd: Command) {
        const handler = executeRequest.value
        if (handler) handler(cmd)
        else await executeCommandOn(ctx, cmd)
      }

      // Flattens every command AND every nested subCommand (recursively —
      // subCommands can themselves have subCommands) into one id->Command
      // map, so a shortcut declared on a nested command gets bound too.
      // Top-level-only traversal used to silently skip every subCommand
      // shortcut entirely.
      function flattenShortcuttable(cmds: Command[], out: Map<string, Command>): void {
        for (const cmd of cmds) {
          if (cmd.shortcut?.length) out.set(cmd.id, cmd)
          if (cmd.subCommands?.length) flattenShortcuttable(cmd.subCommands, out)
        }
      }

      const bound = new Map<string, () => void>()
      watch(
        () => Array.from(store.state.commands.values()),
        (cmds) => {
          const shortcuttable = new Map<string, Command>()
          flattenShortcuttable(cmds, shortcuttable)

          for (const [id, unregister] of bound) {
            if (!shortcuttable.has(id)) {
              unregister()
              bound.delete(id)
            }
          }
          for (const [id, cmd] of shortcuttable) {
            if (!bound.has(id)) {
              const unregister = keyboard.registerShortcut(
                cmd.shortcut!,
                () => void runFallback(cmd),
              )
              bound.set(id, unregister)
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
