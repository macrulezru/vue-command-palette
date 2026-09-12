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

// ─── ctx-based core operations ─────────────────────────────────────────────
// Free functions taking a PaletteContext explicitly, instead of closing over
// a composable's local bindings — so the exact same open/close/execute logic
// can run both from useCommandPalette() (inside a mounted component, via
// inject()) and from plugin.ts's `bindShortcuts` fallback (at plugin-install
// time, no component/inject context available). Two independent
// reimplementations of this logic used to drift apart (e.g. the fallback
// hotkey handler not clearing `history` on close the way close() does, or
// not opening a `page`-only command the way executeCommand() does).

export function openOn(ctx: PaletteContext, paletteId?: string): void {
  if (paletteId && ctx.isOpen.value) {
    ctx.history.value.push({
      paletteId,
      query: ctx.query.value,
      activeIndex: ctx.activeIndex.value,
    })
    ctx.query.value = ''
    ctx.activeIndex.value = 0
  } else {
    ctx.isOpen.value = true
    ctx.query.value = ''
    ctx.activeIndex.value = 0
    ctx.onOpen?.()
  }
}

export function closeOn(ctx: PaletteContext): void {
  ctx.isOpen.value = false
  ctx.query.value = ''
  ctx.activeIndex.value = 0
  ctx.history.value = []
  ctx.onClose?.()
}

export function toggleOn(ctx: PaletteContext): void {
  if (ctx.isOpen.value) closeOn(ctx)
  else openOn(ctx)
}

export function addRecentOn(ctx: PaletteContext, id: string): void {
  const ids = ctx.recentIds.value.filter((i) => i !== id)
  ids.unshift(id)
  ctx.recentIds.value = ids.slice(0, ctx.maxRecent)
  if (ctx.persistRecent) saveRecent(ctx.recentIds.value, ctx.localStorageKey)
}

function recordQueryOn(ctx: PaletteContext, q: string): void {
  const trimmed = q.trim()
  if (!trimmed) return
  ctx.queryHistory.value = [trimmed, ...ctx.queryHistory.value.filter((x) => x !== trimmed)].slice(
    0,
    25,
  )
}

function recordUsageOn(ctx: PaletteContext, id: string): void {
  if (!ctx.frecency) return
  const prev = ctx.usage.value[id]
  ctx.usage.value = {
    ...ctx.usage.value,
    [id]: { count: (prev?.count ?? 0) + 1, lastUsed: Date.now() },
  }
  if (ctx.persistRecent && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ctx.localStorageKey + ':frecency', JSON.stringify(ctx.usage.value))
    } catch {
      // ignore quota / availability errors
    }
  }
}

/**
 * Opens `cmd` (subCommands/page) or runs it: confirms first if `cmd.confirm`
 * is set and no CommandPalette UI is mounted (see `executeRequest`'s doc
 * comment — a mounted UI shows its own confirm dialog before ever calling
 * this, so this fallback path is skipped then), then records recent/frecency/
 * query history and calls `perform()`. Shared by useCommandPalette()'s
 * `executeCommand` and plugin.ts's `bindShortcuts` fallback, so both paths
 * stay behaviorally identical instead of silently drifting apart.
 */
export async function executeCommandOn(ctx: PaletteContext, cmd: Command): Promise<void> {
  if (cmd.disabled || (cmd.enabled && !cmd.enabled())) return

  if (cmd.subCommands?.length || cmd.page) {
    openOn(ctx, cmd.id)
    return
  }

  if (cmd.confirm && !ctx.executeRequest.value) {
    // No CommandPalette UI is mounted to show its own confirm dialog — fall
    // back to the browser's native confirm() so an author's explicit safety
    // gate on a shortcut-triggered command is never silently bypassed.
    // Outside a browser (SSR, tests, no `window`) there's no way to ask at
    // all — refuse to execute rather than silently skip the confirmation.
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
      console.warn(
        `[@macrulez/vue-command-palette] Command "${cmd.id}" requires confirmation, but no ` +
          'CommandPalette UI is mounted and window.confirm() is unavailable — refusing to run it.',
      )
      return
    }
    if (!window.confirm(cmd.confirm)) return
  }

  addRecentOn(ctx, cmd.id)
  recordUsageOn(ctx, cmd.id)
  recordQueryOn(ctx, ctx.query.value)
  closeOn(ctx)

  ctx.loadingCommandId.value = cmd.id
  try {
    await cmd.perform()
  } catch (err) {
    if (ctx.onError) ctx.onError(err, cmd)
    else console.error('[@macrulez/vue-command-palette] Command error:', err)
  } finally {
    ctx.loadingCommandId.value = null
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
      throw new Error(
        `[@macrulez/vue-command-palette] No palette instance named "${name}". Install it with app.use(VCommandPalettePlugin, { name: "${name}" }).`,
      )
    }
    return ctx
  }
  const ctx = inject<PaletteContext>(PALETTE_INJECT_KEY)
  if (!ctx)
    throw new Error(
      '[@macrulez/vue-command-palette] Plugin not installed. Use app.use(VCommandPalettePlugin).',
    )
  return ctx
}

export function useCommandPalette(name?: string) {
  const ctx = resolvePaletteContext(name)

  const {
    store,
    isOpen,
    query,
    activeIndex,
    history,
    recentIds,
    loadingCommandId,
    results,
    currentResults,
    colorTheme,
    persistRecent,
    localStorageKey,
    pinnedIds,
    queryHistory,
  } = ctx

  function open(paletteId?: string) {
    openOn(ctx, paletteId)
  }

  function close() {
    closeOn(ctx)
  }

  function toggle() {
    toggleOn(ctx)
  }

  function goBack() {
    if (!history.value.length) {
      close()
      return
    }
    const prev = history.value.pop()!
    query.value = prev.query
    activeIndex.value = prev.activeIndex
  }

  function addRecent(id: string) {
    addRecentOn(ctx, id)
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
    pinnedIds.value = pinnedIds.value.filter((i) => i !== id)
    if (persistRecent) saveRecent(pinnedIds.value, localStorageKey + ':pinned')
  }

  function togglePin(id: string) {
    if (isPinned(id)) unpin(id)
    else pin(id)
  }

  function getPinnedCommands(): Command[] {
    return pinnedIds.value.map((id) => store.findCommand(id)).filter((c): c is Command => !!c)
  }

  async function executeCommand(cmd: Command): Promise<void> {
    await executeCommandOn(ctx, cmd)
  }

  async function executeActive(): Promise<void> {
    const list = currentResults.value.length ? currentResults.value : results.value
    const current = list[activeIndex.value]
    if (current) await executeCommand(current.command)
  }

  function getRecentCommands(): Command[] {
    return recentIds.value.map((id) => store.findCommand(id)).filter((c): c is Command => !!c)
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
