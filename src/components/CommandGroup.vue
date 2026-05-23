<template>
  <div v-if="items.length" class="vcp-group">
    <slot name="group-header" :group="group">
      <div class="vcp-group__header" aria-hidden="true">{{ group.label }}</div>
    </slot>
    <CommandItem
      v-for="(result, i) in items"
      :key="result.command.id"
      :command="result.command"
      :active="globalOffset + i === activeIndex"
      :matches="result.matches"
      :item-id="`vcp-item-${result.command.id}`"
      :loading-command-id="loadingCommandId"
      @execute="$emit('execute', result.command)"
      @activate="$emit('activate', globalOffset + i)"
    >
      <template v-if="$slots['item-icon']" #item-icon="s"><slot name="item-icon" v-bind="s" /></template>
      <template v-if="$slots['item-shortcut']" #item-shortcut="s"><slot name="item-shortcut" v-bind="s" /></template>
      <template v-if="$slots['item']" #default="s"><slot name="item" v-bind="s" /></template>
    </CommandItem>
  </div>
</template>

<script setup lang="ts">
import CommandItem from './CommandItem.vue'
import type { Command, CommandGroup, SearchResult } from '../types'

defineProps<{
  group: CommandGroup
  items: SearchResult[]
  activeIndex: number
  globalOffset: number
  loadingCommandId?: string | null
}>()

defineEmits<{
  execute: [command: Command]
  activate: [index: number]
}>()
</script>
