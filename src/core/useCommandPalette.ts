import { inject, onUnmounted, readonly, type ComputedRef, type Ref } from 'vue'
import { PALETTE_INJECT_KEY, PALETTE_REGISTRY_KEY } from '../types'
import type { Command, CommandGroup, CommandUsage, SearchResult } from '../types'
import type { CommandStore } from './CommandStore'
import type { KeyboardManager } from './KeyboardManager'

export interface PaletteContext {
  store: CommandStore
  keyboard: KeyboardManager
  isOpen: Ref<boolean>
  query: Ref<string>
  activeIndex: Ref<number>
  history: Ref<Array<{ paletteId: string; query: string; activeIndex: number }>>
  recentIds: Ref<string[]>
  loadingCommandId: Ref<string | null>
  results: ComputedRef<SearchResult[]>
  /**
   * The results currently displayed by the palette UI — includes async and
   * sub-command results merged in. Kept in sync by `CommandPalette`; falls back
   * to `results` when no palette is mounted. Used by `executeActive` so that
   * programmatic execution matches what the user sees.
   */
  currentResults: Ref<SearchResult[]>
  /**
   * Set by the mounted `CommandPalette` to its UI-aware `execute` handler so
   * bound keyboard shortcuts reuse the same confirm/nested/recent flow. `null`
   * when no palette is mounted (a minimal fallback runs instead).
   */
  executeRequest: Ref<((cmd: Command) => void) | null>
  colorTheme: Ref<'light' | 'dark' | 'system'>
  persistRecent: boolean
  maxRecent: number
  maxRecentPerGroup: number
  localStorageKey: string
  frecency: boolean
  usage: Ref<Record<string, CommandUsage>>
  pinnedIds: Ref<string[]>
  queryHistory: Ref<string[]>
  showDisabled: boolean
  /** Async data source applied to every query (plugin-level), merged into results. */
  globalSearch?: (query: string) => Command[] | Promise<Command[]>
  onOpen?: () => void
  onClose?: () => void
  onError?: (err: unknown, command: Command) => void
  onHighlight?: (command: Command | null) => void
}

function saveRecent(ids: string[], key: string) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // ignore quota / availability errors
  }
}

/**
 * Resolves a palette context by instance name. Without a name it returns the
 * default/singleton instance; with a name it looks it up in the registry.
 */
export function resolvePaletteContext(name?: string): PaletteContext {
  if (name) {
    const registry = inject<Map<string, PaletteContext> | null>(PALETTE_REGISTRY_KEY, null)
    const ctx = registry?.get(name)
    if (!ctx) {
      throw new Error(`[@macrulez/vue-command-palette] No palette instance named "${name}". Install it with app.use(VCommandPalettePlugin, { name: "${name}" }).`)
    }
    return ctx
  }
  const ctx = inject<PaletteContext>(PALETTE_INJECT_KEY)
  if (!ctx) throw new Error('[@macrulez/vue-command-palette] Plugin not installed. Use app.use(VCommandPalettePlugin).')
  return ctx
}

export function useCommandPalette(name?: string) {
  const ctx = resolvePaletteContext(name)

  const {
    store, isOpen, query, activeIndex, history, recentIds,
    loadingCommandId, results, currentResults, colorTheme, persistRecent, maxRecent, localStorageKey,
    frecency, usage, pinnedIds, queryHistory,
    onOpen: onOpenCb, onClose: onCloseCb, onError: onErrorCb,
  } = ctx

  function open(paletteId?: string) {
    if (paletteId && isOpen.value) {
      history.value.push({ paletteId, query: query.value, activeIndex: activeIndex.value })
      query.value = ''
      activeIndex.value = 0
    } else {
      isOpen.value = true
      query.value = ''
      activeIndex.value = 0
      onOpenCb?.()
    }
  }

  function close() {
    isOpen.value = false
    query.value = ''
    activeIndex.value = 0
    history.value = []
    onCloseCb?.()
  }

  function toggle() {
    if (isOpen.value) close()
    else open()
  }

  function goBack() {
    if (!history.value.length) { close(); return }
    const prev = history.value.pop()!
    query.value = prev.query
    activeIndex.value = prev.activeIndex
  }

  function addRecent(id: string) {
    // Always track recent in memory; only persist to localStorage when enabled.
    const ids = recentIds.value.filter(i => i !== id)
    ids.unshift(id)
    recentIds.value = ids.slice(0, maxRecent)
    if (persistRecent) saveRecent(recentIds.value, localStorageKey)
  }

  function isPinned(id: string): boolean {
    return pinnedIds.value.includes(id)
  }

  function pin(id: string) {
    if (pinnedIds.value.includes(id)) return
    pinnedIds.value = [...pinnedIds.value, id]
    if (persistRecent) saveRecent(pinnedIds.value, localStorageKey + ':pinned')
  }

  function unpin(id: string) {
    pinnedIds.value = pinnedIds.value.filter(i => i !== id)
    if (persistRecent) saveRecent(pinnedIds.value, localStorageKey + ':pinned')
  }

  function togglePin(id: string) {
    if (isPinned(id)) unpin(id)
    else pin(id)
  }

  function getPinnedCommands(): Command[] {
    return pinnedIds.value
      .map(id => store.findCommand(id))
      .filter((c): c is Command => !!c)
  }

  function recordQuery(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    queryHistory.value = [trimmed, ...queryHistory.value.filter(x => x !== trimmed)].slice(0, 25)
  }

  function recordUsage(id: string) {
    if (!frecency) return
    const prev = usage.value[id]
    usage.value = { ...usage.value, [id]: { count: (prev?.count ?? 0) + 1, lastUsed: Date.now() } }
    if (persistRecent && typeof localStorage !== 'undefined') {
      try { localStorage.setItem(localStorageKey + ':frecency', JSON.stringify(usage.value)) } catch { /* ignore */ }
    }
  }

  async function executeCommand(cmd: Command): Promise<void> {
    if (cmd.disabled || (cmd.enabled && !cmd.enabled())) return

    if (cmd.subCommands?.length || cmd.page) {
      open(cmd.id)
      return
    }

    addRecent(cmd.id)
    recordUsage(cmd.id)
    recordQuery(query.value)
    close()

    loadingCommandId.value = cmd.id
    try {
      await cmd.perform()
    } catch (err) {
      if (onErrorCb) onErrorCb(err, cmd)
      else console.error('[@macrulez/vue-command-palette] Command error:', err)
    } finally {
      loadingCommandId.value = null
    }
  }

  async function executeActive(): Promise<void> {
    const list = currentResults.value.length ? currentResults.value : results.value
    const current = list[activeIndex.value]
    if (current) await executeCommand(current.command)
  }

  function getRecentCommands(): Command[] {
    return recentIds.value
      .map(id => store.findCommand(id))
      .filter((c): c is Command => !!c)
  }

  function registerCommands<T = unknown>(commands: Command<T>[]): () => void {
    return store.registerCommands(commands)
  }

  function registerGroup<T = unknown>(group: CommandGroup<T>): () => void {
    return store.registerGroup(group)
  }

  return {
    isOpen: readonly(isOpen),
    query,
    results,
    activeIndex,
    history: readonly(history),
    loadingCommandId: readonly(loadingCommandId),
    colorTheme,
    open,
    close,
    toggle,
    goBack,
    executeActive,
    executeCommand,
    getRecentCommands,
    getPinnedCommands,
    registerCommands,
    registerGroup,
    addRecent,
    isPinned,
    pin,
    unpin,
    togglePin,
    pinnedIds: readonly(pinnedIds),
    queryHistory: readonly(queryHistory),
  }
}

export function useRegisterCommands<T = unknown>(commands: Command<T>[], name?: string): void {
  const ctx = resolvePaletteContext(name)
  const cleanup = ctx.store.registerCommands(commands)
  onUnmounted(cleanup)
}

export function useRegisterGroup<T = unknown>(group: CommandGroup<T>, name?: string): void {
  const ctx = resolvePaletteContext(name)
  const cleanup = ctx.store.registerGroup(group)
  onUnmounted(cleanup)
}
