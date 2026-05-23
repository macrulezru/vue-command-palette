export { VCommandPalettePlugin } from './plugin'
export { useCommandPalette, useRegisterCommands, useRegisterGroup } from './core/useCommandPalette'
export { fuzzySearch, highlightMatches } from './core/FuzzySearch'
export { createCommandStore } from './core/CommandStore'
export { createKeyboardManager } from './core/KeyboardManager'

export { default as CommandPalette } from './components/CommandPalette.vue'
export { default as CommandItem } from './components/CommandItem.vue'
export { default as CommandGroup } from './components/CommandGroup.vue'
export { default as VirtualList } from './components/VirtualList.vue'

export type {
  Command,
  CommandGroup as CommandGroupType,
  CommandSection,
  PaletteState,
  SearchResult,
  PaletteOptions,
} from './types'
export type { PaletteContext } from './core/useCommandPalette'
export type { CommandStore } from './core/CommandStore'
export type { KeyboardManager } from './core/KeyboardManager'
