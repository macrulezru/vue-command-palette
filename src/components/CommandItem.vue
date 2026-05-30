<script setup lang="ts">
import { computed, inject } from 'vue'
import { highlightMatches } from '../core/FuzzySearch'
import { PALETTE_LABELS_KEY, PALETTE_PINNED_KEY, PALETTE_QUERY_KEY, PALETTE_SELECTION_KEY } from '../types'
import type { Command, PaletteLabels } from '../types'

interface SelectionState { selectable: boolean; isSelected: (id: string) => boolean }

const props = defineProps<{
  command: Command
  active: boolean
  matches: Array<[number, number]>
  itemId: string
  loadingCommandId?: string | null
  parents?: Command[]
  matchedText?: string
  alwaysShowPin?: boolean
}>()

defineEmits<{
  execute: []
  activate: []
}>()

const isDisabled = computed(() =>
  props.command.disabled || (props.command.enabled != null && !props.command.enabled())
)

const isLoading = computed(() => props.loadingCommandId === props.command.id)

// Whether this command opens a nested palette / page (shows a chevron affordance)
const hasChildren = computed(() => !!props.command.subCommands?.length || !!props.command.page)

const badgeText = computed(() => {
  const b = props.command.badge
  return typeof b === 'string' ? b : b?.text
})
const badgeColor = computed(() => (typeof props.command.badge === 'object' ? props.command.badge.color : undefined))

const injectedLabels = inject<{ value: PaletteLabels } | undefined>(PALETTE_LABELS_KEY, undefined)
const loadingLabel = computed(() => injectedLabels?.value.loading ?? 'Loading')

const selection = inject<{ value: SelectionState } | undefined>(PALETTE_SELECTION_KEY, undefined)
const selectable = computed(() => selection?.value.selectable ?? false)
const selected = computed(() => selectable.value && (selection?.value.isSelected(props.command.id) ?? false))

interface PinApi { isPinned: (id: string) => boolean; toggle: (id: string) => void }
const pinApi = inject<PinApi | undefined>(PALETTE_PINNED_KEY, undefined)
const isPinned = computed(() => pinApi?.isPinned(props.command.id) ?? false)
const pinTitle = computed(() => isPinned.value ? (injectedLabels?.value.unpin ?? 'Unpin') : (injectedLabels?.value.pin ?? 'Pin'))
function onPinClick() { pinApi?.toggle(props.command.id) }

const highlighted = computed(() => highlightMatches(props.command.label, props.matches))

// Highlight the current query inside the description (e.g. command matched "Opens"
// by its description) so it's clear why the command is in the results.
const injectedQuery = inject<{ value: string } | undefined>(PALETTE_QUERY_KEY, undefined)
const descriptionHighlighted = computed(() => {
  const desc = props.command.description ?? ''
  const q = (injectedQuery?.value ?? '').trim()
  if (!desc || !q) return highlightMatches(desc, [])
  const idx = desc.toLowerCase().indexOf(q.toLowerCase())
  return highlightMatches(desc, idx === -1 ? [] : [[idx, idx + q.length - 1]])
})

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  if (uaData?.platform) return /mac/i.test(uaData.platform)
  return /mac/i.test(navigator.platform || navigator.userAgent || '')
}

function formatKey(key: string): string {
  if (key === '$mod') return isMac() ? '⌘' : 'Ctrl'
  if (key === 'shift') return '⇧'
  if (key === 'alt') return isMac() ? '⌥' : 'Alt'
  return key.toUpperCase()
}
</script>

<template>
  <div
    :id="itemId"
    class="vcp-item"
    :class="{
      'vcp-item--active': active,
      'vcp-item--disabled': isDisabled,
      'vcp-item--loading': isLoading,
      'vcp-item--selected': selected,
    }"
    role="option"
    :aria-selected="active"
    :aria-disabled="isDisabled"
    :title="isDisabled && command.disabledReason ? command.disabledReason : undefined"
    @click="!isDisabled && !isLoading && $emit('execute')"
    @mouseenter="!isDisabled && $emit('activate')"
  >
    <slot :command="command" :active="active" :matches="matches" :parents="parents" :matched-text="matchedText">
      <span v-if="selectable" class="vcp-item__checkbox" :class="{ 'vcp-item__checkbox--on': selected }" aria-hidden="true" />
      <slot name="item-icon" :command="command">
        <span v-if="command.icon" class="vcp-item__icon">
          <component :is="typeof command.icon === 'string' ? 'span' : command.icon">
            {{ typeof command.icon === 'string' ? command.icon : '' }}
          </component>
        </span>
      </slot>

      <span class="vcp-item__body">
        <span class="vcp-item__label">
          <span v-if="parents?.length" class="vcp-item__context">
            <template v-for="p in parents" :key="p.id">{{ p.label }} › </template>
          </span>
          <component :is="highlighted" />
          <span v-if="matchedText && !matches.length" class="vcp-item__match-hint">— {{ matchedText }}</span>
        </span>
        <span v-if="command.description" class="vcp-item__description">
          <component :is="descriptionHighlighted" />
        </span>
      </span>

      <span
        v-if="badgeText"
        class="vcp-item__badge"
        :style="badgeColor ? { background: badgeColor } : undefined"
      >{{ badgeText }}</span>

      <slot name="item-shortcut" :command="command">
        <span v-if="isLoading" class="vcp-item__spinner" :aria-label="loadingLabel" />
        <span v-else-if="command.shortcut?.length" class="vcp-item__shortcut">
          <kbd v-for="key in command.shortcut" :key="key" class="vcp-kbd">
            {{ formatKey(key) }}
          </kbd>
        </span>
        <span v-else-if="command.actions?.length" class="vcp-item__actions-hint" aria-hidden="true" title="Tab for actions">⋯</span>
      </slot>

      <!-- Reserved pin column: always present; the glyph shows when pinned, or on
           hover/keyboard-active rows as a ghost affordance. Clicking toggles the pin
           without executing the command. -->
      <span
        class="vcp-item__pin"
        :class="{ 'vcp-item__pin--on': isPinned, 'vcp-item__pin--show': props.alwaysShowPin }"
        :title="pinTitle"
        aria-hidden="true"
        @click.stop="onPinClick"
      >
        <svg class="vcp-item__pin-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <path d="M16 9V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v5l-2 2v2h5v5l1 1 1-1v-5h5v-2l-2-2z" />
        </svg>
      </span>

      <!-- Reserved chevron column: present on every row, glyph only for groups/pages -->
      <span class="vcp-item__chevron" aria-hidden="true">{{ hasChildren ? '›' : '' }}</span>
    </slot>
  </div>
</template>
