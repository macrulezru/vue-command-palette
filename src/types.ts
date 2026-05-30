import type { Component } from 'vue'

/**
 * A dedicated "page" a command can open — like a sub-palette, but with its own
 * input placeholder and an async search handler driven by the query. Useful for
 * filters, remote pickers, and multi-step flows.
 */
export interface CommandPage {
  /** Placeholder shown in the input while on this page. */
  placeholder?: string
  /** Static items shown when the query is empty. */
  items?: Command[]
  /** Query-driven results (debounced). Falls back to filtering `items` if omitted. */
  onSearch?: (query: string) => Command[] | Promise<Command[]>
}

/** A secondary action available on a command (opened via the actions menu). */
export interface CommandAction {
  id: string
  label: string
  icon?: Component | string
  shortcut?: string[]
  perform: () => void | Promise<void>
}

export interface Command<T = unknown> {
  id: string
  label: string
  description?: string
  group?: string
  keywords?: string[]
  aliases?: string[]
  icon?: Component | string
  shortcut?: string[]
  disabled?: boolean
  enabled?: () => boolean
  /** Explanation shown (tooltip) when the command is disabled. */
  disabledReason?: string
  /** Small label rendered next to the command (e.g. "New", "Pro", a count). */
  badge?: string | { text: string; color?: string }
  confirm?: string
  perform: () => void | Promise<void>
  subCommands?: Command<T>[]
  /** Opens a nested page with its own input/async search when selected. */
  page?: CommandPage
  /** Secondary actions, opened with `Tab` from the active item. */
  actions?: CommandAction[]
  /** Extra detail (plain text or HTML) shown in the preview pane for this command. */
  info?: string
  /** Arbitrary, type-safe payload carried by the command (e.g. for previews/handlers). */
  data?: T
}

export interface CommandGroup<T = unknown> {
  id: string
  label: string
  priority?: number
  commands: Command<T>[]
  onSearch?: (query: string) => Promise<Command<T>[]>
}

/**
 * A search scope activated by a prefix in the query (e.g. `>` commands, `@` symbols).
 * While active, the prefix is stripped and results come from `onSearch` (or, if
 * omitted, the regular fuzzy search over the stripped query).
 */
export interface PaletteMode {
  prefix: string
  placeholder?: string
  label?: string
  onSearch?: (query: string) => Command[] | Promise<Command[]>
}

export interface PaletteState {
  isOpen: boolean
  query: string
  activeIndex: number
  history: Array<{ paletteId: string; query: string; activeIndex: number }>
  recentIds: string[]
}

export interface SearchResult<T = unknown> {
  command: Command<T>
  score: number
  matches: Array<[start: number, end: number]>
  groupId?: string
  /** Ancestor commands when this result is a nested sub-command (for breadcrumb context). */
  parents?: Command<T>[]
  /** Which field produced the winning score. */
  matchedField?: 'label' | 'description' | 'keyword' | 'alias'
  /** The matching keyword/alias text (for an explanatory hint when the label itself didn't match). */
  matchedText?: string
}

/**
 * Pluggable search strategy. Receives the raw query and all available commands,
 * returns ranked results (highest score first). `groupId` is filled in by the
 * store afterwards, so a custom scorer can leave it undefined.
 */
export type SearchFn<T = unknown> = (query: string, commands: Command<T>[]) => SearchResult<T>[]

/** Per-command usage statistics powering frecency ranking. */
export interface CommandUsage {
  count: number
  lastUsed: number
}

export interface PaletteLabels {
  /** Header above the recent-commands section (empty query). */
  recent: string
  /** Header above the pinned-commands section (empty query). */
  pinned: string
  /** `title`/`aria-label` of the pin affordance (not yet pinned). */
  pin: string
  /** `title`/`aria-label` of the pin affordance (already pinned). */
  unpin: string
  /** Confirm dialog — proceed button. */
  confirmYes: string
  /** Confirm dialog — cancel button. */
  confirmCancel: string
  /** Theme switcher button titles. */
  themeLight: string
  themeDark: string
  themeSystem: string
  /** `aria-label` of the dialog element. */
  dialogLabel: string
  /** `aria-label` of the per-item loading spinner. */
  loading: string
  /** Screen-reader announcement of the result count (aria-live). */
  resultsCount: (n: number) => string
  /** Header of the secondary-actions menu. */
  actions: string
  /** "Back" affordance label (actions menu, etc.). */
  back: string
  /** `title`/`aria-label` of the preview-pane toggle button. */
  togglePreview: string
}

export interface PaletteOptions {
  /** Instance name for running multiple independent palettes (default `'default'`). */
  name?: string
  hotkey?: string[]
  persistRecent?: boolean
  maxRecent?: number
  maxRecentPerGroup?: number
  localStorageKey?: string
  colorTheme?: 'light' | 'dark' | 'system'
  /** Replace the built-in fuzzy search with a custom strategy (e.g. Fuse.js). */
  search?: SearchFn
  /** Include nested `subCommands` in search results (default `true`). */
  searchNested?: boolean
  /** Show disabled commands (greyed, non-executable) instead of hiding them (default `false`). */
  showDisabled?: boolean
  /** Boost frequently & recently used commands in the ranking (default `false`). */
  frecency?: boolean
  /** Async data source applied to every query, merged with regular results. */
  onSearch?: (query: string) => Command[] | Promise<Command[]>
  /** Auto-register each command's `shortcut` as a real global hotkey. */
  bindShortcuts?: boolean
  onOpen?: () => void
  onClose?: () => void
  onError?: (err: unknown, command: Command) => void
  /** Called when the keyboard-active command changes (useful for previews/analytics). */
  onHighlight?: (command: Command | null) => void
}

export const PALETTE_INJECT_KEY = Symbol('@macrulez/vue-command-palette')
export const PALETTE_LABELS_KEY = Symbol('@macrulez/vue-command-palette:labels')
export const PALETTE_SELECTION_KEY = Symbol('@macrulez/vue-command-palette:selection')
export const PALETTE_QUERY_KEY = Symbol('@macrulez/vue-command-palette:query')
export const PALETTE_PINNED_KEY = Symbol('@macrulez/vue-command-palette:pinned')
/** Registry of all named palette instances installed on the app. */
export const PALETTE_REGISTRY_KEY = Symbol('@macrulez/vue-command-palette:registry')
