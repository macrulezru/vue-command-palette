import { describe, expect, it } from 'vitest'
import { fuzzySearch } from './FuzzySearch'
import { createCommandStore } from './CommandStore'
import type { Command, SearchResult } from '../types'

interface User {
  email: string
}

describe('typed command data (generic Command<T>)', () => {
  it('carries data and infers it through fuzzySearch', () => {
    const cmds: Command<User>[] = [
      { id: 'a', label: 'Alice', data: { email: 'alice@x.io' }, perform: () => {} },
    ]
    const results: SearchResult<User>[] = fuzzySearch('alice', cmds)
    // result.command.data is typed as User | undefined here
    expect(results[0].command.data?.email).toBe('alice@x.io')
  })

  it('constrains the data shape at compile time', () => {
    // @ts-expect-error — data must match User
    const bad: Command<User> = { id: 'b', label: 'B', data: { nope: 1 }, perform: () => {} }
    expect(bad.id).toBe('b')
  })

  it('store.registerCommands<T> accepts typed commands', () => {
    const store = createCommandStore()
    const cleanup = store.registerCommands<User>([
      { id: 'c', label: 'C', data: { email: 'c@x.io' }, perform: () => {} },
    ])
    expect(store.getAllCommands()).toHaveLength(1)
    cleanup()
  })

  it('defaults to unknown data when no type argument is given', () => {
    const c: Command = { id: 'd', label: 'D', perform: () => {} }
    expect(c.data).toBeUndefined()
  })
})
