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
          class="vcp-dialog"
          :class="`vcp-dialog--${theme}`"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          @keydown="onDialogKeydown"
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
                  Yes, proceed
                </button>
                <button class="vcp-confirm__btn vcp-confirm__btn--no" @click="confirmingCommand = null">
                  Cancel
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <slot name="header" />

            <div class="vcp-input-wrap">
              <slot name="input" :query="query" :on-input="onInput">
                <input
                  :id="inputId"
                  ref="inputEl"
                  v-model="query"
                  class="vcp-input"
                  type="text"
                  autocomplete="off"
                  spellcheck="false"
                  :placeholder="placeholder"
                  role="combobox"
                  aria-expanded="true"
                  :aria-controls="listboxId"
                  :aria-activedescendant="activeItemId"
                  @input="onInput"
                />
              </slot>

              <div class="vcp-theme-switcher" aria-label="Color theme">
                <button
                  v-for="t in (['light', 'system', 'dark'] as const)"
                  :key="t"
                  class="vcp-theme-btn"
                  :class="{ 'vcp-theme-btn--active': ctx.colorTheme.value === t }"
                  :title="t === 'light' ? 'Light theme' : t === 'dark' ? 'Dark theme' : 'System theme'"
                  type="button"
                  @click="ctx.colorTheme.value = t"
                >
                  <span class="vcp-theme-icon" :class="`vcp-theme-icon--${t}`" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div
              :id="listboxId"
              ref="listEl"
              class="vcp-list"
              role="listbox"
              :aria-label="placeholder"
              v-show="isLoading || currentSubCommands != null || recentCommands.length || query.trim() || allGroupedFlat.length"
            >
              <div v-if="isLoading" class="vcp-state vcp-state--loading">{{ loadingText }}</div>

              <!-- No query: nested palette sub-commands OR recent + all commands -->
              <template v-else-if="!query.trim()">
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

                <!-- Top level: recent (if any) + all commands -->
                <template v-else>
                  <template v-if="recentCommands.length">
                    <div class="vcp-group__header" aria-hidden="true">Recent</div>
                    <CommandItem
                      v-for="(cmd, i) in recentCommands"
                      :key="cmd.id"
                      :command="cmd"
                      :active="i === activeIndex"
                      :matches="[]"
                      :item-id="`vcp-item-recent-${cmd.id}`"
                      :loading-command-id="loadingCommandId"
                      @execute="execute(cmd)"
                      @activate="activeIndex = i"
                    >
                      <template v-if="$slots['item-icon']" #item-icon="s"><slot name="item-icon" v-bind="s" /></template>
                      <template v-if="$slots['item-shortcut']" #item-shortcut="s"><slot name="item-shortcut" v-bind="s" /></template>
                      <template v-if="$slots['item']" #default="s"><slot name="item" v-bind="s" /></template>
                    </CommandItem>
                    <div v-if="allGrouped.length" class="vcp-section" aria-hidden="true" />
                  </template>

                  <template v-for="(entry, gi) in allGrouped" :key="entry.group.id">
                    <div v-if="gi > 0" class="vcp-section" aria-hidden="true" />
                    <CommandGroup
                      :group="entry.group"
                      :items="entry.items"
                      :active-index="activeIndex"
                      :global-offset="recentCommands.length + allGroupedOffset(gi)"
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
                <VirtualList :items="flatItems" :item-height="ITEM_HEIGHT" :container-height="LIST_HEIGHT">
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

              <div v-else-if="query.trim()" class="vcp-state vcp-state--empty">
                <slot name="empty" :query="query">{{ emptyText }}</slot>
              </div>
            </div>

            <slot name="footer" />
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import CommandItem from './CommandItem.vue'
import CommandGroup from './CommandGroup.vue'
import VirtualList from './VirtualList.vue'
import { useCommandPalette } from '../core/useCommandPalette'
import { PALETTE_INJECT_KEY } from '../types'
import type { Command, CommandGroup as ICommandGroup, SearchResult } from '../types'
import type { PaletteContext } from '../core/useCommandPalette'

const VIRTUAL_THRESHOLD = 50
const ITEM_HEIGHT = 40
const LIST_HEIGHT = 360

const props = withDefaults(defineProps<{
  placeholder?: string
  maxResults?: number
  emptyText?: string
  loadingText?: string
  teleportTo?: string
  theme?: 'default' | 'compact'
  animationDuration?: number
}>(), {
  placeholder: 'Search commands…',
  maxResults: 10,
  emptyText: 'No commands found.',
  loadingText: 'Loading…',
  teleportTo: 'body',
  theme: 'default',
  animationDuration: 150,
})

const ctx = inject<PaletteContext>(PALETTE_INJECT_KEY)!
const palette = useCommandPalette()

const { isOpen, query, activeIndex, history, loadingCommandId, close, toggle, open, executeCommand, getRecentCommands } = palette
const inputEl = ref<HTMLInputElement>()
const listEl = ref<HTMLElement>()
const isLoading = ref(false)
const confirmingCommand = ref<Command | null>(null)

const inputId = 'vcp-input'
const listboxId = 'vcp-listbox'

// maxRecentPerGroup — если 0, нет ограничения
const recentCommands = computed(() => {
  const all = getRecentCommands()
  if (!ctx.maxRecentPerGroup) return all

  const countPerGroup: Record<string, number> = {}
  return all.filter(cmd => {
    const gid = cmd.group ?? '__none__'
    countPerGroup[gid] = (countPerGroup[gid] ?? 0) + 1
    return countPerGroup[gid] <= ctx.maxRecentPerGroup
  })
})

// Sub-commands of the current nested palette (null when at top level)
const currentSubCommands = computed<Command[] | null>(() => {
  if (!history.value.length) return null
  const paletteId = history.value[history.value.length - 1].paletteId
  const cmd = ctx.store.getAllCommands().find(c => c.id === paletteId)
  if (!cmd?.subCommands?.length) return null
  return cmd.subCommands.filter(c => !c.disabled && (c.enabled == null || c.enabled()))
})

// All commands grouped (shown when no query and no recent)
const allGrouped = computed(() =>
  ctx.store.getSortedGroups()
    .map(group => ({
      group,
      items: group.commands
        .filter(cmd => !cmd.disabled && (cmd.enabled == null || cmd.enabled()))
        .map(cmd => ({ command: cmd, score: 0, matches: [] as Array<[number, number]>, groupId: group.id } as SearchResult)),
    }))
    .filter(g => g.items.length > 0)
)

const allGroupedFlat = computed(() => allGrouped.value.flatMap(g => g.items))

function allGroupedOffset(gi: number): number {
  return allGrouped.value.slice(0, gi).reduce((s, g) => s + g.items.length, 0)
}

// Async search with debounce
const asyncResults = ref<SearchResult[]>([])
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(query, async (q) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  const asyncGroups = ctx.store.getSortedGroups().filter(g => g.onSearch)
  if (!asyncGroups.length || !q.trim()) { asyncResults.value = []; return }

  debounceTimer = setTimeout(async () => {
    isLoading.value = true
    try {
      const all = await Promise.all(
        asyncGroups.map(g => g.onSearch!(q).then(cmds =>
          cmds.map(c => ({ command: c, score: 50, matches: [], groupId: g.id } as SearchResult))
        ))
      )
      asyncResults.value = all.flat()
    } finally {
      isLoading.value = false
    }
  }, 200)
})

const syncResults = computed(() => ctx.store.search(query.value))

const displayResults = computed(() => {
  const subs = currentSubCommands.value
  if (subs !== null && query.value.trim()) {
    const q = query.value.toLowerCase()
    return subs
      .filter(c =>
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.keywords?.some(k => k.toLowerCase().includes(q))
      )
      .map(c => ({ command: c, score: 50, matches: [] as Array<[number, number]>, groupId: undefined } as SearchResult))
  }
  const merged = [...syncResults.value]
  for (const ar of asyncResults.value) {
    if (!merged.find(r => r.command.id === ar.command.id)) merged.push(ar)
  }
  return merged.sort((a, b) => b.score - a.score).slice(0, props.maxResults)
})

const groupedResults = computed(() => {
  const groups = ctx.store.getSortedGroups()
  const out: Array<{ group: ICommandGroup; items: SearchResult[]; offset: number; section: boolean }> = []
  let offset = 0
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]
    const items = displayResults.value.filter(r => r.groupId === group.id)
    if (items.length) {
      out.push({ group, items, offset, section: gi > 0 && out.length > 0 })
      offset += items.length
    }
  }
  return out
})

const ungroupedOffset = computed(() => groupedResults.value.reduce((s, g) => s + g.items.length, 0))
const ungroupedResults = computed(() => displayResults.value.filter(r => !r.groupId))

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

const activeItemId = computed(() => {
  const r = displayResults.value[activeIndex.value]
  return r ? `vcp-item-${r.command.id}` : undefined
})

function getBreadcrumbLabel(paletteId: string): string {
  return ctx.store.getAllCommands().find(c => c.id === paletteId)?.label ?? paletteId
}

function onInput() { activeIndex.value = 0 }

async function execute(command: Command) {
  if (command.confirm) {
    confirmingCommand.value = command
    return
  }
  await executeCommand(command)
}

async function confirmExecute() {
  if (!confirmingCommand.value) return
  const cmd = confirmingCommand.value
  confirmingCommand.value = null
  await executeCommand(cmd)
}

function scrollActiveIntoView() {
  nextTick(() => {
    listEl.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  })
}

function onDialogKeydown(e: KeyboardEvent) {
  // Confirmation mode — только Escape и Enter
  if (confirmingCommand.value) {
    if (e.key === 'Escape') { e.preventDefault(); confirmingCommand.value = null }
    if (e.key === 'Enter') { e.preventDefault(); confirmExecute() }
    return
  }

  const total = displayResults.value.length
    || (query.value.trim() ? 0 :
      currentSubCommands.value
        ? currentSubCommands.value.length
        : recentCommands.value.length + allGroupedFlat.value.length)
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
      const current = displayResults.value[activeIndex.value]
      if (current?.command) execute(current.command)
    } else {
      const i = activeIndex.value
      let cmd: Command | undefined
      if (currentSubCommands.value) {
        cmd = currentSubCommands.value[i]
      } else {
        cmd = i < recentCommands.value.length
          ? recentCommands.value[i]
          : allGroupedFlat.value[i - recentCommands.value.length]?.command
      }
      if (cmd) execute(cmd)
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    history.value.length ? palette.goBack() : close()
  } else if (e.key === 'Backspace' && !query.value) {
    e.preventDefault()
    palette.goBack()
  } else if (e.key === 'Tab') {
    e.preventDefault()
    inputEl.value?.focus()
  }
}

watch(isOpen, async (opened) => {
  if (typeof document === 'undefined') return
  if (opened) {
    activeIndex.value = 0
    document.body.style.overflow = 'hidden'
    await nextTick()
    inputEl.value?.focus()
  } else {
    document.body.style.overflow = ''
    confirmingCommand.value = null
  }
})
</script>

<style src="../style.css"></style>
