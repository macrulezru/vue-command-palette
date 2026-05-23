import type { Component } from 'vue'

export interface Command {
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
  confirm?: string
  perform: () => void | Promise<void>
  subCommands?: Command[]
}

export interface CommandGroup {
  id: string
  label: string
  priority?: number
  commands: Command[]
  onSearch?: (query: string) => Promise<Command[]>
}

export interface CommandSection {
  type: 'section'
  id: string
}

export interface PaletteState {
  isOpen: boolean
  query: string
  activeIndex: number
  history: Array<{ paletteId: string; query: string; activeIndex: number }>
  recentIds: string[]
}

export interface SearchResult {
  command: Command
  score: number
  matches: Array<[start: number, end: number]>
  groupId?: string
}

export interface PaletteOptions {
  hotkey?: string[]
  persistRecent?: boolean
  maxRecent?: number
  maxRecentPerGroup?: number
  localStorageKey?: string
  colorTheme?: 'light' | 'dark' | 'system'
  onOpen?: () => void
  onClose?: () => void
  onError?: (err: unknown, command: Command) => void
}

export const PALETTE_INJECT_KEY = Symbol('@macrulez/vue-command-palette')
