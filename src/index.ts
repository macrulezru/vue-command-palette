export { VCommandPalettePlugin, createCommandPalette, installPalette } from './plugin'
export { useCommandPalette, useRegisterCommands, useRegisterGroup, resolvePaletteContext } from './core/useCommandPalette'
export { fuzzySearch, highlightMatches, getMatchRanges } from './core/FuzzySearch'
export { createCommandStore } from './core/CommandStore'
export { createKeyboardManager } from './core/KeyboardManager'

export { default as CommandPalette } from './components/CommandPalette.vue'
export { default as CommandItem } from './components/CommandItem.vue'
export { default as CommandGroup } from './components/CommandGroup.vue'
export { default as VirtualList } from './components/VirtualList.vue'

export type {
  Command,
  CommandGroup as CommandGroupType,
  CommandPage,
  CommandAction,
  PaletteState,
  SearchResult,
  SearchFn,
  CommandUsage,
  PaletteMode,
  PaletteOptions,
  PaletteLabels,
} from './types'
export type { PaletteContext } from './core/useCommandPalette'
export type { CommandStore } from './core/CommandStore'
export type { KeyboardManager } from './core/KeyboardManager'
