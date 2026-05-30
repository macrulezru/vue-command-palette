import { reactive } from 'vue'
import { compareByRelevance, fuzzySearch } from './FuzzySearch'
import type { Command, CommandGroup, SearchFn, SearchResult } from '../types'

export interface CommandStoreState {
  groups: Map<string, CommandGroup>
  commands: Map<string, Command>
}

export function createCommandStore(
  searchFn?: SearchFn,
  searchNested = true,
  scoreBonus?: (command: Command) => number,
  showDisabled = false,
) {
  // Default scorer honours `showDisabled`; a custom searchFn controls its own filtering.
  const search0: SearchFn = searchFn ?? ((q, cmds) => fuzzySearch(q, cmds, showDisabled))

  const state = reactive<CommandStoreState>({
    groups: new Map(),
    commands: new Map(),
  })

  function registerCommands<T = unknown>(commands: Command<T>[], groupId?: string): () => void {
    for (const cmd of commands) {
      state.commands.set(cmd.id, cmd)
      if (groupId && state.groups.has(groupId)) {
        const group = state.groups.get(groupId)!
        if (!group.commands.find(c => c.id === cmd.id)) {
          group.commands.push(cmd)
        }
      }
    }
    return () => {
      for (const cmd of commands) {
        state.commands.delete(cmd.id)
        if (groupId && state.groups.has(groupId)) {
          const group = state.groups.get(groupId)!
          const idx = group.commands.findIndex(c => c.id === cmd.id)
          if (idx !== -1) group.commands.splice(idx, 1)
        }
      }
    }
  }

  function registerGroup<T = unknown>(group: CommandGroup<T>): () => void {
    state.groups.set(group.id, reactive(group) as CommandGroup)
    for (const cmd of group.commands) {
      state.commands.set(cmd.id, cmd)
    }
    return () => {
      const g = state.groups.get(group.id)
      if (g) {
        for (const cmd of g.commands) state.commands.delete(cmd.id)
      }
      state.groups.delete(group.id)
    }
  }

  function getAllCommands(): Command[] {
    return Array.from(state.commands.values())
  }

  // Finds a command by id anywhere in the tree, including nested subCommands —
  // so recent/pinned can resolve a leaf command that isn't registered directly.
  function findCommand(id: string): Command | undefined {
    const direct = state.commands.get(id)
    if (direct) return direct
    const stack = Array.from(state.commands.values())
    while (stack.length) {
      const cmd = stack.pop()!
      if (cmd.subCommands?.length) {
        for (const sub of cmd.subCommands) {
          if (sub.id === id) return sub
          if (sub.subCommands?.length) stack.push(sub)
        }
      }
    }
    return undefined
  }

  function search(query: string): SearchResult[] {
    if (!query.trim()) return []

    // Build the searchable list. When searchNested is on, flatten subCommands
    // (recursively) and remember each command's ancestor chain for context.
    let list = getAllCommands()
    const parentsOf = new Map<Command, Command[]>()
    if (searchNested) {
      const flat: Command[] = []
      const walk = (cmd: Command, chain: Command[]) => {
        flat.push(cmd)
        if (chain.length) parentsOf.set(cmd, chain)
        if (cmd.subCommands?.length) {
          for (const child of cmd.subCommands) walk(child, [...chain, cmd])
        }
      }
      for (const cmd of list) walk(cmd, [])
      list = flat
    }

    const results = search0(query, list)

    // Build a commandId -> groupId index once (first group wins), then assign
    // in O(1) per result instead of scanning every group for every result.
    const groupOf = new Map<string, string>()
    for (const [gid, group] of state.groups) {
      for (const cmd of group.commands) {
        if (!groupOf.has(cmd.id)) groupOf.set(cmd.id, gid)
      }
    }

    for (const result of results) {
      const chain = parentsOf.get(result.command)
      if (chain?.length) result.parents = chain
      // Nested results inherit the group of their top-level ancestor.
      const lookupId = chain?.length ? chain[0].id : result.command.id
      const gid = groupOf.get(lookupId)
      if (gid) result.groupId = gid
      // Frecency: nudge frequently/recently used commands up the ranking.
      if (scoreBonus) result.score += scoreBonus(result.command)
    }

    if (scoreBonus) results.sort(compareByRelevance)

    return results
  }

  function getSortedGroups(): CommandGroup[] {
    return Array.from(state.groups.values()).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    )
  }

  return { state, registerCommands, registerGroup, search, getAllCommands, findCommand, getSortedGroups }
}

export type CommandStore = ReturnType<typeof createCommandStore>
