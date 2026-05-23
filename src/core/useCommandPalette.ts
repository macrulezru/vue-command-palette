import { computed, inject, onUnmounted, readonly, ref, type ComputedRef, type Ref } from 'vue'
import { PALETTE_INJECT_KEY } from '../types'
import type { Command, CommandGroup, SearchResult } from '../types'
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
  persistRecent: boolean
  maxRecent: number
  maxRecentPerGroup: number
  localStorageKey: string
  onOpen?: () => void
  onClose?: () => void
  onError?: (err: unknown, command: Command) => void
}

function saveRecent(ids: string[], key: string) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {}
}

export function useCommandPalette() {
  const ctx = inject<PaletteContext>(PALETTE_INJECT_KEY)
  if (!ctx) throw new Error('[vue-command-palette] Plugin not installed. Use app.use(VCommandPalettePlugin).')

  const {
    store, isOpen, query, activeIndex, history, recentIds,
    loadingCommandId, results, persistRecent, maxRecent, localStorageKey,
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
    if (!persistRecent) return
    const ids = recentIds.value.filter(i => i !== id)
    ids.unshift(id)
    recentIds.value = ids.slice(0, maxRecent)
    saveRecent(recentIds.value, localStorageKey)
  }

  async function executeCommand(cmd: Command): Promise<void> {
    if (cmd.disabled || (cmd.enabled && !cmd.enabled())) return

    if (cmd.subCommands?.length) {
      open(cmd.id)
      store.registerCommands(cmd.subCommands, cmd.id)
      return
    }

    addRecent(cmd.id)
    close()

    loadingCommandId.value = cmd.id
    try {
      await cmd.perform()
    } catch (err) {
      if (onErrorCb) onErrorCb(err, cmd)
      else console.error('[vue-command-palette] Command error:', err)
    } finally {
      loadingCommandId.value = null
    }
  }

  async function executeActive(): Promise<void> {
    const current = results.value[activeIndex.value]
    if (current) await executeCommand(current.command)
  }

  function getRecentCommands(): Command[] {
    const allCommands = store.getAllCommands()
    return recentIds.value
      .map(id => allCommands.find(c => c.id === id))
      .filter((c): c is Command => !!c)
  }

  function registerCommands(commands: Command[]): () => void {
    return store.registerCommands(commands)
  }

  function registerGroup(group: CommandGroup): () => void {
    return store.registerGroup(group)
  }

  return {
    isOpen: readonly(isOpen),
    query,
    results,
    activeIndex,
    history: readonly(history),
    loadingCommandId: readonly(loadingCommandId),
    open,
    close,
    toggle,
    goBack,
    executeActive,
    executeCommand,
    getRecentCommands,
    registerCommands,
    registerGroup,
    addRecent,
  }
}

export function useRegisterCommands(commands: Command[]): void {
  const ctx = inject<PaletteContext>(PALETTE_INJECT_KEY)
  if (!ctx) throw new Error('[vue-command-palette] Plugin not installed.')
  const cleanup = ctx.store.registerCommands(commands)
  onUnmounted(cleanup)
}

export function useRegisterGroup(group: CommandGroup): void {
  const ctx = inject<PaletteContext>(PALETTE_INJECT_KEY)
  if (!ctx) throw new Error('[vue-command-palette] Plugin not installed.')
  const cleanup = ctx.store.registerGroup(group)
  onUnmounted(cleanup)
}
