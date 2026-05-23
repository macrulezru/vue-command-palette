<template>
  <div
    :id="itemId"
    class="vcp-item"
    :class="{
      'vcp-item--active': active,
      'vcp-item--disabled': isDisabled,
      'vcp-item--loading': isLoading,
    }"
    role="option"
    :aria-selected="active"
    :aria-disabled="isDisabled"
    @click="!isDisabled && !isLoading && $emit('execute')"
    @mouseenter="!isDisabled && $emit('activate')"
  >
    <slot :command="command" :active="active" :matches="matches">
      <slot name="item-icon" :command="command">
        <span v-if="command.icon" class="vcp-item__icon">
          <component :is="typeof command.icon === 'string' ? 'span' : command.icon">
            {{ typeof command.icon === 'string' ? command.icon : '' }}
          </component>
        </span>
      </slot>

      <span class="vcp-item__body">
        <span class="vcp-item__label">
          <component :is="highlighted" />
        </span>
        <span v-if="command.description" class="vcp-item__description">
          {{ command.description }}
        </span>
      </span>

      <slot name="item-shortcut" :command="command">
        <span v-if="isLoading" class="vcp-item__spinner" aria-label="Loading" />
        <span v-else-if="command.shortcut?.length" class="vcp-item__shortcut">
          <kbd v-for="key in command.shortcut" :key="key" class="vcp-kbd">
            {{ formatKey(key) }}
          </kbd>
        </span>
      </slot>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { highlightMatches } from '../core/FuzzySearch'
import type { Command } from '../types'

const props = defineProps<{
  command: Command
  active: boolean
  matches: Array<[number, number]>
  itemId: string
  loadingCommandId?: string | null
}>()

defineEmits<{
  execute: []
  activate: []
}>()

const isDisabled = computed(() =>
  props.command.disabled || (props.command.enabled != null && !props.command.enabled())
)

const isLoading = computed(() => props.loadingCommandId === props.command.id)

const highlighted = computed(() => highlightMatches(props.command.label, props.matches))

function formatKey(key: string): string {
  if (key === '$mod') return typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'
  if (key === 'shift') return '⇧'
  if (key === 'alt') return typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌥' : 'Alt'
  return key.toUpperCase()
}
</script>
