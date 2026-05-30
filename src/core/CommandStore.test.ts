import { describe, expect, it, vi } from 'vitest'
import { createCommandStore } from './CommandStore'
import type { Command, CommandGroup } from '../types'

function cmd(id: string, label: string, extra: Partial<Command> = {}): Command {
  return { id, label, perform: () => {}, ...extra }
}

describe('createCommandStore', () => {
  it('registers commands and lists them', () => {
    const store = createCommandStore()
    store.registerCommands([cmd('a', 'Alpha'), cmd('b', 'Beta')])
    expect(store.getAllCommands().map(c => c.id).sort()).toEqual(['a', 'b'])
  })

  it('cleanup fn unregisters commands', () => {
    const store = createCommandStore()
    const cleanup = store.registerCommands([cmd('a', 'Alpha')])
    cleanup()
    expect(store.getAllCommands()).toHaveLength(0)
  })

  it('registers a group and its commands', () => {
    const store = createCommandStore()
    store.registerGroup({ id: 'g', label: 'Group', commands: [cmd('a', 'Alpha')] })
    expect(store.getAllCommands()).toHaveLength(1)
    expect(store.getSortedGroups().map(g => g.id)).toEqual(['g'])
  })

  it('cleanup fn unregisters a group and its commands', () => {
    const store = createCommandStore()
    const cleanup = store.registerGroup({ id: 'g', label: 'Group', commands: [cmd('a', 'Alpha')] })
    cleanup()
    expect(store.getAllCommands()).toHaveLength(0)
    expect(store.getSortedGroups()).toHaveLength(0)
  })

  it('appends commands to an existing group when groupId is given', () => {
    const store = createCommandStore()
    store.registerGroup({ id: 'g', label: 'Group', commands: [] })
    store.registerCommands([cmd('a', 'Alpha')], 'g')
    expect(store.getSortedGroups()[0].commands.map(c => c.id)).toEqual(['a'])
  })

  it('does not duplicate a command already in the group', () => {
    const store = createCommandStore()
    store.registerGroup({ id: 'g', label: 'Group', commands: [cmd('a', 'Alpha')] })
    store.registerCommands([cmd('a', 'Alpha')], 'g')
    expect(store.getSortedGroups()[0].commands).toHaveLength(1)
  })

  it('search returns [] for empty/blank query', () => {
    const store = createCommandStore()
    store.registerCommands([cmd('a', 'Alpha')])
    expect(store.search('')).toEqual([])
    expect(store.search('   ')).toEqual([])
  })

  it('search assigns groupId to results', () => {
    const store = createCommandStore()
    store.registerGroup({ id: 'g', label: 'Group', commands: [cmd('a', 'Alpha')] })
    const results = store.search('alpha')
    expect(results[0].groupId).toBe('g')
  })

  it('first group wins when a command id exists in multiple groups', () => {
    const store = createCommandStore()
    store.registerGroup({ id: 'g1', label: 'One', commands: [cmd('a', 'Alpha')] })
    store.registerGroup({ id: 'g2', label: 'Two', commands: [cmd('a', 'Alpha')] })
    const results = store.search('alpha')
    expect(results[0].groupId).toBe('g1')
  })

  it('uses a custom search strategy when provided', () => {
    const custom = vi.fn((_q: string, cmds: Command[]) =>
      cmds.map(c => ({ command: c, score: 1, matches: [] as Array<[number, number]> })),
    )
    const store = createCommandStore(custom)
    store.registerGroup({ id: 'g', label: 'Group', commands: [cmd('a', 'Alpha')] })
    const results = store.search('whatever')
    expect(custom).toHaveBeenCalled()
    expect(results[0].command.id).toBe('a')
    // store still assigns groupId on top of custom results
    expect(results[0].groupId).toBe('g')
  })

  it('surfaces nested subCommands in search with parent context', () => {
    const store = createCommandStore()
    store.registerGroup({
      id: 'appearance',
      label: 'Appearance',
      commands: [
        cmd('theme', 'Change Theme', {
          subCommands: [cmd('theme-light', 'Light'), cmd('theme-dark', 'Dark')],
        }),
      ],
    })
    const results = store.search('light')
    const light = results.find(r => r.command.id === 'theme-light')
    expect(light).toBeDefined()
    expect(light!.parents?.map(p => p.id)).toEqual(['theme'])
    // nested result inherits the group of its top-level ancestor
    expect(light!.groupId).toBe('appearance')
  })

  it('does not surface nested subCommands when searchNested is false', () => {
    const store = createCommandStore(undefined, false)
    store.registerCommands([
      cmd('theme', 'Change Theme', { subCommands: [cmd('theme-light', 'Light')] }),
    ])
    const results = store.search('light')
    expect(results.find(r => r.command.id === 'theme-light')).toBeUndefined()
  })

  it('applies a score bonus (frecency) and re-sorts', () => {
    // Both match "set" as substring (score 60); bonus lifts 'b' above 'a'.
    const store = createCommandStore(undefined, true, (c) => (c.id === 'b' ? 50 : 0))
    store.registerCommands([cmd('a', 'Reset view'), cmd('b', 'Reset cache')])
    const results = store.search('reset')
    expect(results[0].command.id).toBe('b')
  })

  it('findCommand resolves top-level and nested sub-commands', () => {
    const store = createCommandStore()
    store.registerGroup({
      id: 'g', label: 'G',
      commands: [cmd('parent', 'Parent', { subCommands: [cmd('child', 'Child')] })],
    })
    expect(store.findCommand('parent')?.id).toBe('parent')
    expect(store.findCommand('child')?.id).toBe('child')
    expect(store.findCommand('ghost')).toBeUndefined()
  })

  it('getSortedGroups orders by priority descending', () => {
    const store = createCommandStore()
    const g = (id: string, priority?: number): CommandGroup => ({ id, label: id, commands: [], priority })
    store.registerGroup(g('low', 1))
    store.registerGroup(g('high', 100))
    store.registerGroup(g('none'))
    expect(store.getSortedGroups().map(x => x.id)).toEqual(['high', 'low', 'none'])
  })
})
