<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import CommandItem from './CommandItem.vue'
import CommandGroup from './CommandGroup.vue'
import VirtualList from './VirtualList.vue'
import { compareByRelevance, getMatchRanges } from '../core/FuzzySearch'
import { resolvePaletteContext, useCommandPalette } from '../core/useCommandPalette'
import { PALETTE_LABELS_KEY, PALETTE_PINNED_KEY, PALETTE_QUERY_KEY, PALETTE_SELECTION_KEY } from '../types'
import type { Command, CommandAction, CommandPage, PaletteLabels, PaletteMode, SearchResult } from '../types'

const DEFAULT_LABELS: PaletteLabels = {
  recent: 'Recent',
  pinned: 'Pinned',
  pin: 'Pin',
  unpin: 'Unpin',
  confirmYes: 'Yes, proceed',
  confirmCancel: 'Cancel',
  themeLight: 'Light theme',
  themeDark: 'Dark theme',
  themeSystem: 'System theme',
  dialogLabel: 'Command palette',
  loading: 'Loading',
  resultsCount: (n: number) => `${n} result${n === 1 ? '' : 's'} available`,
  actions: 'Actions',
  back: 'Back',
  togglePreview: 'Toggle preview panel',
}

const VIRTUAL_THRESHOLD = 50
const ITEM_HEIGHT = 40
const LIST_HEIGHT = 360

const props = withDefaults(defineProps<{
  /** Target a specific named palette instance (default singleton when omitted). */
  name?: string
  placeholder?: string
  maxResults?: number
  emptyText?: string
  loadingText?: string
  teleportTo?: string
  theme?: 'default' | 'compact'
  animationDuration?: number
  labels?: Partial<PaletteLabels>
  /** Cluster recent commands by their `group` with sub-headers (empty query view). */
  groupRecent?: boolean
  /** Prefix-activated search scopes (e.g. `>` commands, `@` symbols). */
  modes?: PaletteMode[]
  /** Enable multi-select: Enter toggles, $mod+Enter submits the selection. */
  selectable?: boolean
  /** Show a preview pane (right column) for the active command via the `#preview` slot and command `info`. */
  preview?: boolean
  /** Key combo that toggles the preview pane (default `['$mod', 'i']`; empty to disable). */
  previewHotkey?: string[]
}>(), {
  name: undefined,
  placeholder: 'Search commands…',
  maxResults: 10,
  emptyText: 'No commands found.',
  loadingText: 'Loading…',
  teleportTo: 'body',
  theme: 'default',
  animationDuration: 150,
  labels: undefined,
  groupRecent: false,
  modes: undefined,
  selectable: false,
  preview: false,
  previewHotkey: () => ['$mod', 'i'],
})

const emit = defineEmits<{
  'submit-selection': [commands: Command[]]
}>()

// Preview pane: feature gate (`preview`) + user-controlled expand/collapse.
const previewExpanded = ref(true)
const showPreview = computed(() => props.preview && previewExpanded.value)
function togglePreview() { previewExpanded.value = !previewExpanded.value }

const labelsResolved = computed<PaletteLabels>(() => ({ ...DEFAULT_LABELS, ...props.labels }))
provide(PALETTE_LABELS_KEY, labelsResolved)

const ctx = resolvePaletteContext(props.name)
const palette = useCommandPalette(props.name)

const { isOpen, query, activeIndex, history, loadingCommandId, close, toggle, open, executeCommand, getRecentCommands, getPinnedCommands, togglePin, pinnedIds } = palette

// Expose the live query so items can highlight matches inside the description,
// and a pin API so items can show/toggle a pin indicator.
provide(PALETTE_QUERY_KEY, query)
provide(PALETTE_PINNED_KEY, {
  isPinned: (id: string) => pinnedIds.value.includes(id),
  toggle: (id: string) => togglePin(id),
})

const inputEl = ref<HTMLInputElement>()
const listEl = ref<HTMLElement>()
const dialogEl = ref<HTMLElement>()
const isLoading = ref(false)
const confirmingCommand = ref<Command | null>(null)
const queryHistoryIndex = ref(-1)
const actionsCommand = ref<Command | null>(null)
const activeActionIndex = ref(0)
const selectedIds = ref<string[]>([])

function isSelected(id: string): boolean { return selectedIds.value.includes(id) }
function toggleSelect(id: string) {
  selectedIds.value = isSelected(id) ? selectedIds.value.filter(i => i !== id) : [...selectedIds.value, id]
}
provide(PALETTE_SELECTION_KEY, computed(() => ({
  selectable: props.selectable,
  isSelected,
})))

const inputId = 'vcp-input'
const listboxId = 'vcp-listbox'

// Whether to render a command. Disabled commands are kept (greyed) when showDisabled is on.
function keep(c: Command): boolean {
  return ctx.showDisabled || (!c.disabled && (c.enabled == null || c.enabled()))
}

// Pinned commands shown at the very top of the no-query view
const pinnedCommands = computed<Command[]>(() => getPinnedCommands().filter(keep))

// maxRecentPerGroup — если 0, нет ограничения
const recentCommands = computed(() => {
  const all = getRecentCommands()
  let list = all
  if (ctx.maxRecentPerGroup) {
    const countPerGroup: Record<string, number> = {}
    list = all.filter(cmd => {
      const gid = cmd.group ?? '__none__'
      countPerGroup[gid] = (countPerGroup[gid] ?? 0) + 1
      return countPerGroup[gid] <= ctx.maxRecentPerGroup
    })
  }
  // When grouping recent, cluster by group (stable, first-seen order) so the flat
  // navigation order matches the rendered sections.
  if (props.groupRecent) {
    const order: string[] = []
    const buckets = new Map<string, Command[]>()
    for (const cmd of list) {
      const key = cmd.group ?? ''
      if (!buckets.has(key)) { buckets.set(key, []); order.push(key) }
      buckets.get(key)!.push(cmd)
    }
    list = order.flatMap(key => buckets.get(key)!)
  }
  return list
})

// Recent split into contiguous group sections (null when grouping is disabled).
const recentSections = computed<Array<{ label: string; commands: Command[]; offset: number }> | null>(() => {
  if (!props.groupRecent) return null
  const sections: Array<{ label: string; commands: Command[]; offset: number }> = []
  let idx = 0
  for (const cmd of recentCommands.value) {
    const key = cmd.group ?? ''
    const last = sections[sections.length - 1]
    if (last && last.label === key) last.commands.push(cmd)
    else sections.push({ label: key, commands: [cmd], offset: idx })
    idx++
  }
  return sections
})

// Active prefix mode (scope), if the query starts with a configured prefix
const activeMode = computed<PaletteMode | null>(() => {
  if (!props.modes?.length || currentPage.value) return null
  return props.modes.find(m => m.prefix && query.value.startsWith(m.prefix)) ?? null
})
const modeQuery = computed(() => activeMode.value ? query.value.slice(activeMode.value.prefix.length) : query.value)

// Command at the top of the nested-navigation stack (null at top level).
// store.findCommand recurses into subCommands, so deep nesting (Git → Branches → …) resolves.
const currentNestedCommand = computed<Command | null>(() => {
  if (!history.value.length) return null
  return ctx.store.findCommand(history.value[history.value.length - 1].paletteId) ?? null
})

// The page of the current nested command, if it is a page (null otherwise)
const currentPage = computed<CommandPage | null>(() => currentNestedCommand.value?.page ?? null)

// Static nested items (subCommands or page.items); null only at top level
const currentSubCommands = computed<Command[] | null>(() => {
  const cmd = currentNestedCommand.value
  if (!cmd) return null
  if (cmd.page) return (cmd.page.items ?? []).filter(keep)
  if (cmd.subCommands?.length) return cmd.subCommands.filter(keep)
  return null
})

// All commands grouped (shown when no query and no recent)
const allGrouped = computed(() =>
  ctx.store.getSortedGroups()
    .map(group => ({
      group,
      items: group.commands
        .filter(keep)
        .map(cmd => ({ command: cmd, score: 0, matches: [] as Array<[number, number]>, groupId: group.id } as SearchResult)),
    }))
    .filter(g => g.items.length > 0)
)

const allGroupedFlat = computed(() => allGrouped.value.flatMap(g => g.items))

function allGroupedOffset(gi: number): number {
  return allGrouped.value.slice(0, gi).reduce((s, g) => s + g.items.length, 0)
}

// No-query view is a flat navigable list: pinned → recent → all-grouped.
const recentBase = computed(() => pinnedCommands.value.length)
const allGroupedBase = computed(() => pinnedCommands.value.length + recentCommands.value.length)
const noQueryFlat = computed<Command[]>(() => [
  ...pinnedCommands.value,
  ...recentCommands.value,
  ...allGroupedFlat.value.map(r => r.command),
])

// Async search with debounce
const asyncResults = ref<SearchResult[]>([])
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(query, async (q) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  const asyncGroups = ctx.store.getSortedGroups().filter(g => g.onSearch)
  const hasGlobal = typeof ctx.globalSearch === 'function'
  if ((!asyncGroups.length && !hasGlobal) || !q.trim()) { asyncResults.value = []; return }

  debounceTimer = setTimeout(async () => {
    isLoading.value = true
    try {
      const groupResults = await Promise.all(
        asyncGroups.map(g => g.onSearch!(q).then(cmds =>
          cmds.map(c => ({ command: c, score: 50, matches: getMatchRanges(q, c.label), groupId: g.id } as SearchResult))
        ))
      )
      const merged = groupResults.flat()
      if (ctx.globalSearch) {
        const globalCmds = await ctx.globalSearch(q)
        for (const c of globalCmds) {
          if (!merged.find(r => r.command.id === c.id)) {
            merged.push({ command: c, score: 50, matches: getMatchRanges(q, c.label), groupId: undefined } as SearchResult)
          }
        }
      }
      asyncResults.value = merged
    } finally {
      isLoading.value = false
    }
  }, 200)
})

// Page async search with debounce (query-driven results for the current page)
const pageResults = ref<SearchResult[]>([])
let pageDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch([query, currentPage], async ([q, page]) => {
  if (pageDebounceTimer) clearTimeout(pageDebounceTimer)
  if (!page?.onSearch || !q.trim()) { pageResults.value = []; return }

  pageDebounceTimer = setTimeout(async () => {
    isLoading.value = true
    try {
      const cmds = await page.onSearch!(q)
      pageResults.value = cmds.map(c => ({ command: c, score: 50, matches: getMatchRanges(q, c.label), groupId: undefined } as SearchResult))
    } finally {
      isLoading.value = false
    }
  }, 200)
})

// Mode (scope) async search with debounce
const modeResults = ref<SearchResult[]>([])
let modeDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch([modeQuery, activeMode], async ([mq, mode]) => {
  if (modeDebounceTimer) clearTimeout(modeDebounceTimer)
  if (!mode?.onSearch || !mq.trim()) { modeResults.value = []; return }

  modeDebounceTimer = setTimeout(async () => {
    isLoading.value = true
    try {
      const cmds = await mode.onSearch!(mq)
      modeResults.value = cmds.map(c => ({ command: c, score: 50, matches: getMatchRanges(mq, c.label), groupId: undefined } as SearchResult))
    } finally {
      isLoading.value = false
    }
  }, 200)
})

function filterStatic(items: Command[], q: string): SearchResult[] {
  const lq = q.toLowerCase()
  return items
    .filter(c =>
      c.label.toLowerCase().includes(lq) ||
      c.description?.toLowerCase().includes(lq) ||
      c.keywords?.some(k => k.toLowerCase().includes(lq))
    )
    .map(c => ({ command: c, score: 50, matches: getMatchRanges(q, c.label), groupId: undefined } as SearchResult))
}

// Reuse the shared computed from the plugin context instead of running the
// search a second time per keystroke.
const syncResults = ctx.results

const displayResults = computed(() => {
  // Prefix mode (scope): async results, or regular fuzzy over the stripped query
  const mode = activeMode.value
  if (mode) {
    if (!modeQuery.value.trim()) return []
    if (mode.onSearch) return modeResults.value
    return ctx.store.search(modeQuery.value).slice(0, props.maxResults)
  }

  // Page mode: async results, or filter the page's static items
  const page = currentPage.value
  if (page) {
    if (!query.value.trim()) return []
    if (page.onSearch) return pageResults.value
    return filterStatic(page.items ?? [], query.value)
  }

  // Plain sub-commands: filter the static list
  const subs = currentSubCommands.value
  if (subs !== null && query.value.trim()) {
    return filterStatic(subs, query.value)
  }

  const merged = [...syncResults.value]
  for (const ar of asyncResults.value) {
    if (!merged.find(r => r.command.id === ar.command.id)) merged.push(ar)
  }
  return merged.sort(compareByRelevance).slice(0, props.maxResults)
})

const groupedResults = computed(() => {
  // Order groups by their best matching item (its rank in the relevance-sorted
  // displayResults), so the group with the strongest match comes first — not by
  // the group's static priority.
  const built = ctx.store.getSortedGroups()
    .map(group => {
      const items = displayResults.value.filter(r => r.groupId === group.id)
      return { group, items, bestIndex: items.length ? displayResults.value.indexOf(items[0]) : Infinity }
    })
    .filter(g => g.items.length > 0)
    .sort((a, b) => a.bestIndex - b.bestIndex)

  let offset = 0
  return built.map((g, i) => {
    const entry = { group: g.group, items: g.items, offset, section: i > 0 }
    offset += g.items.length
    return entry
  })
})

const ungroupedOffset = computed(() => groupedResults.value.reduce((s, g) => s + g.items.length, 0))
const ungroupedResults = computed(() => displayResults.value.filter(r => !r.groupId))

// Results in the exact order they are rendered (grouped first, then ungrouped),
// so `activeIndex` maps to the right command — displayResults is sorted by
// relevance, which differs from the on-screen grouped order.
const orderedResults = computed<SearchResult[]>(() => [
  ...groupedResults.value.flatMap(g => g.items),
  ...ungroupedResults.value,
])

type FlatItem =
  | { type: 'group-header'; label: string }
  | { type: 'section' }
  | { type: 'command'; result: SearchResult; index: number }

const flatItems = computed((): FlatItem[] => {
  const out: FlatItem[] = []
  let idx = 0
  for (let gi = 0; gi < groupedResults.value.length; gi++) {
    const { group, items, section } = groupedResults.value[gi]
    if (section) out.push({ type: 'section' })
    out.push({ type: 'group-header', label: group.label })
    for (const result of items) out.push({ type: 'command', result, index: idx++ })
  }
  for (const result of ungroupedResults.value) out.push({ type: 'command', result, index: idx++ })
  return out
})

// Keep the shared context in sync with the on-screen order, so programmatic
// executeActive() matches the visual selection (grouped order, not score order).
watch(orderedResults, (v) => { ctx.currentResults.value = v }, { immediate: true })

// Position of the active command within flatItems (for virtual-list scrolling)
const activeFlatIndex = computed(() =>
  flatItems.value.findIndex(it => it.type === 'command' && it.index === activeIndex.value)
)

const activeItemId = computed(() => {
  const r = orderedResults.value[activeIndex.value]
  return r ? `vcp-item-${r.command.id}` : undefined
})

// The currently keyboard-active command across all view modes
const activeCommand = computed<Command | null>(() => {
  const i = activeIndex.value
  if (query.value.trim()) return orderedResults.value[i]?.command ?? null
  if (currentSubCommands.value) return currentSubCommands.value[i] ?? null
  return noQueryFlat.value[i] ?? null
})

// aria-live announcement of the result count (search mode only)
const resultsAnnouncement = computed(() =>
  isOpen.value && query.value.trim()
    ? labelsResolved.value.resultsCount(displayResults.value.length)
    : ''
)

// Notify consumers when the active command changes (previews / analytics)
watch([activeCommand, isOpen], ([cmd, open]) => {
  ctx.onHighlight?.(open ? cmd : null)
})

function getBreadcrumbLabel(paletteId: string): string {
  return ctx.store.findCommand(paletteId)?.label ?? paletteId
}

function onInput() { activeIndex.value = 0; queryHistoryIndex.value = -1 }

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

function getFocusable(): HTMLElement[] {
  if (!dialogEl.value) return []
  return Array.from(dialogEl.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(el => el.offsetParent !== null || el === document.activeElement)
}

function trapTab(e: KeyboardEvent) {
  const els = getFocusable()
  if (!els.length) {
    e.preventDefault()
    inputEl.value?.focus()
    return
  }
  const first = els[0]
  const last = els[els.length - 1]
  const active = document.activeElement as HTMLElement | null
  const inside = !!active && !!dialogEl.value?.contains(active)
  if (e.shiftKey) {
    if (!inside || active === first) {
      e.preventDefault()
      last.focus()
    }
  } else if (!inside || active === last) {
    e.preventDefault()
    first.focus()
  }
}

async function execute(command: Command) {
  // Multi-select mode: clicking / Enter toggles selection instead of running.
  if (props.selectable) {
    toggleSelect(command.id)
    return
  }
  if (command.confirm) {
    if (!isOpen.value) open()
    confirmingCommand.value = command
    return
  }
  // Ensure nested sub-palettes / pages open correctly even when triggered while closed.
  if ((command.subCommands?.length || command.page) && !isOpen.value) open()
  await executeCommand(command)
}

async function confirmExecute() {
  if (!confirmingCommand.value) return
  const cmd = confirmingCommand.value
  confirmingCommand.value = null
  await executeCommand(cmd)
}

function submitSelection() {
  if (!selectedIds.value.length) return
  const all = ctx.store.getAllCommands()
  const chosen = selectedIds.value
    .map(id => all.find(c => c.id === id))
    .filter((c): c is Command => !!c)
  emit('submit-selection', chosen)
  selectedIds.value = []
  close()
}

function openActions(command: Command) {
  if (!command.actions?.length) return
  actionsCommand.value = command
  activeActionIndex.value = 0
}

function closeActions() {
  actionsCommand.value = null
  nextTick(() => inputEl.value?.focus())
}

async function runAction(action: CommandAction) {
  const parent = actionsCommand.value
  actionsCommand.value = null
  close()
  try {
    await action.perform()
  } catch (err) {
    if (ctx.onError && parent) ctx.onError(err, parent)
    else console.error('[@macrulez/vue-command-palette] Action error:', err)
  }
}

// Expose this UI-aware executor to bound keyboard shortcuts (see bindShortcuts).
onMounted(() => { ctx.executeRequest.value = execute })
onUnmounted(() => { if (ctx.executeRequest.value === execute) ctx.executeRequest.value = null })

// Matches a simple "$mod/ctrl/meta/shift/alt + key" combo against a keyboard event.
function matchesCombo(e: KeyboardEvent, keys: string[]): boolean {
  if (!keys.length) return false
  const main = keys[keys.length - 1].toLowerCase()
  const mods = keys.slice(0, -1)
  const needMod = mods.includes('$mod') || mods.includes('ctrl') || mods.includes('meta')
  if (needMod !== (e.metaKey || e.ctrlKey)) return false
  if (mods.includes('shift') !== e.shiftKey) return false
  if (mods.includes('alt') !== e.altKey) return false
  return e.key.toLowerCase() === main
}

// Touch: swipe right (in a nested view) navigates back
let touchStartX = 0
let touchStartY = 0
function onTouchStart(e: TouchEvent) {
  const t = e.changedTouches[0]
  touchStartX = t.clientX
  touchStartY = t.clientY
}
function onTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0]
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY
  if (dx > 70 && Math.abs(dy) < 50 && history.value.length) navigateBack()
}

function scrollActiveIntoView() {
  nextTick(() => {
    const el = listEl.value?.querySelector('[aria-selected="true"]')
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  })
}

// Go back one nested level and restore the scroll position to the active item.
function navigateBack() {
  palette.goBack()
  scrollActiveIntoView()
}

function onDialogKeydown(e: KeyboardEvent) {
  // Confirmation mode — только Escape и Enter
  if (confirmingCommand.value) {
    if (e.key === 'Escape') { e.preventDefault(); confirmingCommand.value = null }
    if (e.key === 'Enter') { e.preventDefault(); confirmExecute() }
    return
  }

  // Actions menu mode — navigate / run / close
  if (actionsCommand.value) {
    const acts = actionsCommand.value.actions ?? []
    if (e.key === 'Escape' || e.key === 'Tab' || e.key === 'Backspace') { e.preventDefault(); closeActions() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (acts.length) activeActionIndex.value = (activeActionIndex.value + 1) % acts.length }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (acts.length) activeActionIndex.value = (activeActionIndex.value - 1 + acts.length) % acts.length }
    else if (e.key === 'Enter') { e.preventDefault(); const a = acts[activeActionIndex.value]; if (a) runAction(a) }
    return
  }

  // Toggle the preview pane on its configured hotkey
  if (props.preview && matchesCombo(e, props.previewHotkey)) {
    e.preventDefault()
    togglePreview()
    return
  }

  // $mod+P toggles pin on the active command
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    if (activeCommand.value) togglePin(activeCommand.value.id)
    return
  }

  // $mod+Enter submits the current multi-selection
  if (props.selectable && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    submitSelection()
    return
  }

  // Alt+Arrow recalls previous queries (history is most-recent-first)
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const hist = ctx.queryHistory.value
    if (!hist.length) return
    e.preventDefault()
    queryHistoryIndex.value = e.key === 'ArrowUp'
      ? Math.min(queryHistoryIndex.value + 1, hist.length - 1)
      : Math.max(queryHistoryIndex.value - 1, -1)
    query.value = queryHistoryIndex.value >= 0 ? hist[queryHistoryIndex.value] : ''
    activeIndex.value = 0
    return
  }

  const total = displayResults.value.length
    || (query.value.trim() ? 0 :
      currentSubCommands.value
        ? currentSubCommands.value.length
        : noQueryFlat.value.length)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (total) activeIndex.value = (activeIndex.value + 1) % total
    scrollActiveIntoView()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (total) activeIndex.value = (activeIndex.value - 1 + total) % total
    scrollActiveIntoView()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (query.value.trim()) {
      const current = orderedResults.value[activeIndex.value]
      if (current?.command) execute(current.command)
    } else {
      const i = activeIndex.value
      const cmd = currentSubCommands.value ? currentSubCommands.value[i] : noQueryFlat.value[i]
      if (cmd) execute(cmd)
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    if (history.value.length) navigateBack()
    else close()
  } else if (e.key === 'Backspace' && !query.value) {
    e.preventDefault()
    navigateBack()
  } else if (e.key === 'Tab') {
    // Open the secondary-actions menu for the active command, else trap focus
    if (!e.shiftKey && activeCommand.value?.actions?.length) {
      e.preventDefault()
      openActions(activeCommand.value)
    } else {
      trapTab(e)
    }
  }
}

let previouslyFocused: HTMLElement | null = null

watch(isOpen, async (opened) => {
  if (typeof document === 'undefined') return
  if (opened) {
    previouslyFocused = document.activeElement as HTMLElement | null
    activeIndex.value = 0
    document.body.style.overflow = 'hidden'
    await nextTick()
    inputEl.value?.focus()
  } else {
    document.body.style.overflow = ''
    confirmingCommand.value = null
    actionsCommand.value = null
    queryHistoryIndex.value = -1
    selectedIds.value = []
    previouslyFocused?.focus?.()
    previouslyFocused = null
  }
})

// Confirm / actions modes remove the input from the DOM, which drops focus to
// <body> — and then key events no longer reach the dialog handler. Keep focus on
// the dialog itself in those modes, and back on the input otherwise.
watch([confirmingCommand, actionsCommand], async () => {
  if (!isOpen.value) return
  await nextTick()
  if (confirmingCommand.value || actionsCommand.value) dialogEl.value?.focus()
  else inputEl.value?.focus()
})
</script>

<template>
  <slot name="trigger" :open="open" :toggle="toggle" />

  <Teleport :to="teleportTo">
    <Transition name="vcp-fade">
      <div
        v-if="isOpen"
        class="vcp-overlay"
        :class="ctx.colorTheme.value !== 'system' ? `vcp-theme-${ctx.colorTheme.value}` : ''"
        role="presentation"
        @click.self="close"
      >
        <div
          ref="dialogEl"
          class="vcp-dialog"
          :class="[`vcp-dialog--${theme}`, { 'vcp-dialog--preview': showPreview }]"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          :aria-label="labelsResolved.dialogLabel"
          @keydown="onDialogKeydown"
          @touchstart.passive="onTouchStart"
          @touchend.passive="onTouchEnd"
        >
          <!-- Breadcrumb -->
          <div v-if="history.length" class="vcp-breadcrumb" aria-live="polite">
            <span v-for="(item, i) in history" :key="item.paletteId" class="vcp-breadcrumb__item">
              <span v-if="i > 0" class="vcp-breadcrumb__sep" aria-hidden="true">›</span>
              {{ getBreadcrumbLabel(item.paletteId) }}
            </span>
            <span class="vcp-breadcrumb__sep" aria-hidden="true">›</span>
          </div>

          <!-- Confirmation mode -->
          <template v-if="confirmingCommand">
            <div class="vcp-confirm">
              <p class="vcp-confirm__text">{{ confirmingCommand.confirm }}</p>
              <div class="vcp-confirm__actions">
                <button class="vcp-confirm__btn vcp-confirm__btn--yes" @click="confirmExecute">
                  {{ labelsResolved.confirmYes }}
                </button>
                <button class="vcp-confirm__btn vcp-confirm__btn--no" @click="confirmingCommand = null">
                  {{ labelsResolved.confirmCancel }}
                </button>
              </div>
            </div>
          </template>

          <!-- Secondary actions menu -->
          <template v-else-if="actionsCommand">
            <slot name="actions" :command="actionsCommand" :run="runAction" :active-index="activeActionIndex" :close="closeActions">
              <div class="vcp-actions">
                <div class="vcp-actions__bar">
                  <button class="vcp-actions__back" type="button" :title="labelsResolved.back" @click="closeActions">‹</button>
                  <span class="vcp-actions__title">{{ labelsResolved.actions }} — {{ actionsCommand.label }}</span>
                  <span class="vcp-actions__hint"><kbd class="vcp-kbd">Esc</kbd> {{ labelsResolved.back }}</span>
                </div>
                <div
                  v-for="(action, i) in actionsCommand.actions"
                  :key="action.id"
                  class="vcp-item"
                  :class="{ 'vcp-item--active': i === activeActionIndex }"
                  role="option"
                  :aria-selected="i === activeActionIndex"
                  @click="runAction(action)"
                  @mouseenter="activeActionIndex = i"
                >
                  <span v-if="action.icon" class="vcp-item__icon">
                    <component :is="typeof action.icon === 'string' ? 'span' : action.icon">{{ typeof action.icon === 'string' ? action.icon : '' }}</component>
                  </span>
                  <span class="vcp-item__body">
                    <span class="vcp-item__label">{{ action.label }}</span>
                  </span>
                  <span v-if="action.shortcut?.length" class="vcp-item__shortcut">
                    <kbd v-for="k in action.shortcut" :key="k" class="vcp-kbd">{{ k }}</kbd>
                  </span>
                </div>
              </div>
            </slot>
          </template>

          <template v-else>
            <slot name="header" />

            <div class="vcp-input-wrap">
              <span v-if="activeMode" class="vcp-mode-chip">{{ activeMode.label || activeMode.prefix }}</span>
              <slot name="input" :query="query" :on-input="onInput">
                <input
                  :id="inputId"
                  ref="inputEl"
                  v-model="query"
                  class="vcp-input"
                  type="text"
                  autocomplete="off"
                  spellcheck="false"
                  :placeholder="activeMode?.placeholder || currentPage?.placeholder || placeholder"
                  role="combobox"
                  aria-expanded="true"
                  :aria-controls="listboxId"
                  :aria-activedescendant="activeItemId"
                  @input="onInput"
                />
              </slot>

              <span
                v-if="isLoading"
                class="vcp-input-spinner"
                role="status"
                :aria-label="labelsResolved.loading"
              />

              <div class="vcp-theme-switcher" aria-label="Color theme">
                <button
                  v-for="t in (['light', 'system', 'dark'] as const)"
                  :key="t"
                  class="vcp-theme-btn"
                  :class="{ 'vcp-theme-btn--active': ctx.colorTheme.value === t }"
                  :title="t === 'light' ? labelsResolved.themeLight : t === 'dark' ? labelsResolved.themeDark : labelsResolved.themeSystem"
                  type="button"
                  @click="ctx.colorTheme.value = t"
                >
                  <span class="vcp-theme-icon" :class="`vcp-theme-icon--${t}`" aria-hidden="true" />
                </button>
              </div>

              <button
                v-if="preview"
                class="vcp-preview-toggle"
                :class="{ 'vcp-preview-toggle--active': showPreview }"
                type="button"
                :title="labelsResolved.togglePreview"
                :aria-label="labelsResolved.togglePreview"
                :aria-pressed="showPreview"
                @click="togglePreview"
              >
                <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
                  <line x1="10" y1="2.5" x2="10" y2="13.5" />
                </svg>
              </button>
            </div>

            <div class="vcp-body" :class="{ 'vcp-body--with-preview': preview }">
            <div
              v-show="isLoading || currentSubCommands != null || pinnedCommands.length || recentCommands.length || query.trim() || allGroupedFlat.length"
              :id="listboxId"
              ref="listEl"
              class="vcp-list"
              role="listbox"
              :aria-label="placeholder"
            >
              <!-- No query: nested palette sub-commands OR recent + all commands -->
              <template v-if="!query.trim()">
                <!-- Nested palette -->
                <template v-if="currentSubCommands">
                  <CommandItem
                    v-for="(cmd, i) in currentSubCommands"
                    :key="cmd.id"
                    :command="cmd"
                    :active="i === activeIndex"
                    :matches="[]"
                    :item-id="`vcp-item-sub-${cmd.id}`"
                    :loading-command-id="loadingCommandId"
                    @execute="execute(cmd)"
                    @activate="activeIndex = i"
                  >
                    <template v-if="$slots['item-icon']" #item-icon="s"><slot name="item-icon" v-bind="s" /></template>
                    <template v-if="$slots['item-shortcut']" #item-shortcut="s"><slot name="item-shortcut" v-bind="s" /></template>
                    <template v-if="$slots['item']" #default="s"><slot name="item" v-bind="s" /></template>
                  </CommandItem>
                </template>

                <!-- Top level: pinned + recent (if any) + all commands -->
                <template v-else>
                  <template v-if="pinnedCommands.length">
                    <div class="vcp-group__header" aria-hidden="true">{{ labelsResolved.pinned }}</div>
                    <CommandItem
                      v-for="(cmd, i) in pinnedCommands"
                      :key="cmd.id"
                      :command="cmd"
                      :active="i === activeIndex"
                      :matches="[]"
                      :item-id="`vcp-item-pinned-${cmd.id}`"
                      :loading-command-id="loadingCommandId"
                      always-show-pin
                      @execute="execute(cmd)"
                      @activate="activeIndex = i"
                    >
                      <template v-if="$slots['item-icon']" #item-icon="s"><slot name="item-icon" v-bind="s" /></template>
                      <template v-if="$slots['item-shortcut']" #item-shortcut="s"><slot name="item-shortcut" v-bind="s" /></template>
                      <template v-if="$slots['item']" #default="s"><slot name="item" v-bind="s" /></template>
                    </CommandItem>
                    <div v-if="recentCommands.length || allGrouped.length" class="vcp-section" aria-hidden="true" />
                  </template>

                  <template v-if="recentCommands.length">
                    <div class="vcp-group__header" aria-hidden="true">{{ labelsResolved.recent }}</div>

                    <!-- Grouped recent: sub-headers per group -->
                    <template v-if="recentSections">
                      <template v-for="(sec, si) in recentSections" :key="`vcp-recsec-${si}`">
                        <div v-if="sec.label" class="vcp-group__header vcp-group__header--sub" aria-hidden="true">{{ sec.label }}</div>
                        <CommandItem
                          v-for="(cmd, i) in sec.commands"
                          :key="cmd.id"
                          :command="cmd"
                          :active="recentBase + sec.offset + i === activeIndex"
                          :matches="[]"
                          :item-id="`vcp-item-recent-${cmd.id}`"
                          :loading-command-id="loadingCommandId"
                          @execute="execute(cmd)"
                          @activate="activeIndex = recentBase + sec.offset + i"
                        >
                          <template v-if="$slots['item-icon']" #item-icon="s"><slot name="item-icon" v-bind="s" /></template>
                          <template v-if="$slots['item-shortcut']" #item-shortcut="s"><slot name="item-shortcut" v-bind="s" /></template>
                          <template v-if="$slots['item']" #default="s"><slot name="item" v-bind="s" /></template>
                        </CommandItem>
                      </template>
                    </template>

                    <!-- Flat recent -->
                    <template v-else>
                      <CommandItem
                        v-for="(cmd, i) in recentCommands"
                        :key="cmd.id"
                        :command="cmd"
                        :active="recentBase + i === activeIndex"
                        :matches="[]"
                        :item-id="`vcp-item-recent-${cmd.id}`"
                        :loading-command-id="loadingCommandId"
                        @execute="execute(cmd)"
                        @activate="activeIndex = recentBase + i"
                      >
                        <template v-if="$slots['item-icon']" #item-icon="s"><slot name="item-icon" v-bind="s" /></template>
                        <template v-if="$slots['item-shortcut']" #item-shortcut="s"><slot name="item-shortcut" v-bind="s" /></template>
                        <template v-if="$slots['item']" #default="s"><slot name="item" v-bind="s" /></template>
                      </CommandItem>
                    </template>

                    <div v-if="allGrouped.length" class="vcp-section" aria-hidden="true" />
                  </template>

                  <template v-for="(entry, gi) in allGrouped" :key="entry.group.id">
                    <div v-if="gi > 0" class="vcp-section" aria-hidden="true" />
                    <CommandGroup
                      :group="entry.group"
                      :items="entry.items"
                      :active-index="activeIndex"
                      :global-offset="allGroupedBase + allGroupedOffset(gi)"
                      :loading-command-id="loadingCommandId"
                      @execute="execute($event)"
                      @activate="activeIndex = $event"
                    >
                      <template v-if="$slots['group-header']" #group-header="s"><slot name="group-header" v-bind="s" /></template>
                      <template v-if="$slots['item-icon']" #item-icon="s"><slot name="item-icon" v-bind="s" /></template>
                      <template v-if="$slots['item-shortcut']" #item-shortcut="s"><slot name="item-shortcut" v-bind="s" /></template>
                      <template v-if="$slots['item']" #item="s"><slot name="item" v-bind="s" /></template>
                    </CommandGroup>
                  </template>
                </template>
              </template>

              <!-- Virtual list for large result sets -->
              <template v-else-if="displayResults.length > VIRTUAL_THRESHOLD">
                <VirtualList :items="flatItems" :item-height="ITEM_HEIGHT" :container-height="LIST_HEIGHT" :active-index="activeFlatIndex">
                  <template #default="{ item }">
                    <div v-if="item.type === 'group-header'" class="vcp-group__header" aria-hidden="true">
                      {{ item.label }}
                    </div>
                    <div v-else-if="item.type === 'section'" class="vcp-section" aria-hidden="true" />
                    <CommandItem
                      v-else
                      :command="item.result.command"
                      :active="item.index === activeIndex"
                      :matches="item.result.matches"
                      :parents="item.result.parents"
                      :matched-text="item.result.matchedText"
                      :item-id="`vcp-item-${item.result.command.id}`"
                      :loading-command-id="loadingCommandId"
                      @execute="execute(item.result.command)"
                      @activate="activeIndex = item.index"
                    >
                      <template v-if="$slots['item-icon']" #item-icon="s"><slot name="item-icon" v-bind="s" /></template>
                      <template v-if="$slots['item-shortcut']" #item-shortcut="s"><slot name="item-shortcut" v-bind="s" /></template>
                      <template v-if="$slots['item']" #default="s"><slot name="item" v-bind="s" /></template>
                    </CommandItem>
                  </template>
                </VirtualList>
              </template>

              <!-- Normal grouped list -->
              <template v-else-if="displayResults.length">
                <template v-for="entry in groupedResults" :key="entry.group.id">
                  <div v-if="entry.section" class="vcp-section" aria-hidden="true" />
                  <CommandGroup
                    :group="entry.group"
                    :items="entry.items"
                    :active-index="activeIndex"
                    :global-offset="entry.offset"
                    :loading-command-id="loadingCommandId"
                    @execute="execute($event)"
                    @activate="activeIndex = $event"
                  >
                    <template v-if="$slots['group-header']" #group-header="s"><slot name="group-header" v-bind="s" /></template>
                    <template v-if="$slots['item-icon']" #item-icon="s"><slot name="item-icon" v-bind="s" /></template>
                    <template v-if="$slots['item-shortcut']" #item-shortcut="s"><slot name="item-shortcut" v-bind="s" /></template>
                    <template v-if="$slots['item']" #item="s"><slot name="item" v-bind="s" /></template>
                  </CommandGroup>
                </template>

                <CommandItem
                  v-for="(result, i) in ungroupedResults"
                  :key="result.command.id"
                  :command="result.command"
                  :active="ungroupedOffset + i === activeIndex"
                  :matches="result.matches"
                  :parents="result.parents"
                  :matched-text="result.matchedText"
                  :item-id="`vcp-item-${result.command.id}`"
                  :loading-command-id="loadingCommandId"
                  @execute="execute(result.command)"
                  @activate="activeIndex = ungroupedOffset + i"
                >
                  <template v-if="$slots['item-icon']" #item-icon="s"><slot name="item-icon" v-bind="s" /></template>
                  <template v-if="$slots['item-shortcut']" #item-shortcut="s"><slot name="item-shortcut" v-bind="s" /></template>
                  <template v-if="$slots['item']" #default="s"><slot name="item" v-bind="s" /></template>
                </CommandItem>
              </template>

              <!-- Loading only when nothing is shown yet, so existing results aren't blanked -->
              <div v-else-if="isLoading" class="vcp-state vcp-state--loading">{{ loadingText }}</div>

              <div v-else-if="query.trim()" class="vcp-state vcp-state--empty">
                <slot name="empty" :query="query">{{ emptyText }}</slot>
              </div>
            </div>

            <aside
              v-if="preview"
              class="vcp-preview"
              :class="{ 'vcp-preview--collapsed': !previewExpanded }"
              :aria-hidden="!previewExpanded"
            >
              <div class="vcp-preview__inner">
                <slot name="preview" :command="activeCommand" />
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div v-if="activeCommand?.info" class="vcp-preview__info" v-html="activeCommand.info" />
              </div>
            </aside>
            </div>

            <slot name="footer" />

            <div class="vcp-sr-only" role="status" aria-live="polite">{{ resultsAnnouncement }}</div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
