import { reactive } from 'vue'
import { fuzzySearch } from './FuzzySearch'
import type { Command, CommandGroup, SearchResult } from '../types'

export interface CommandStoreState {
  groups: Map<string, CommandGroup>
  commands: Map<string, Command>
}

export function createCommandStore() {
  const state = reactive<CommandStoreState>({
    groups: new Map(),
    commands: new Map(),
  })

  function registerCommands(commands: Command[], groupId?: string): () => void {
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

  function registerGroup(group: CommandGroup): () => void {
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

  function search(query: string): SearchResult[] {
    const all = getAllCommands()
    if (!query.trim()) return []

    const results = fuzzySearch(query, all)

    for (const result of results) {
      for (const [gid, group] of state.groups) {
        if (group.commands.find(c => c.id === result.command.id)) {
          result.groupId = gid
          break
        }
      }
    }

    return results
  }

  function getSortedGroups(): CommandGroup[] {
    return Array.from(state.groups.values()).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    )
  }

  return { state, registerCommands, registerGroup, search, getAllCommands, getSortedGroups }
}

export type CommandStore = ReturnType<typeof createCommandStore>
