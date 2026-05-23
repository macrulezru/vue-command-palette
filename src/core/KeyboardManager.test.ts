// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createKeyboardManager } from './KeyboardManager'

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }))
}

describe('createKeyboardManager', () => {
  let km: ReturnType<typeof createKeyboardManager>

  beforeEach(() => {
    km = createKeyboardManager()
    km.start()
  })

  afterEach(() => {
    km.stop()
    vi.useRealTimers()
  })

  it('fires handler on matching shortcut', () => {
    const handler = vi.fn()
    km.registerShortcut(['$mod', 'k'], handler)
    fireKey('k', { metaKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not fire when modifier is missing', () => {
    const handler = vi.fn()
    km.registerShortcut(['$mod', 'k'], handler)
    fireKey('k')
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not fire when a different key is pressed', () => {
    const handler = vi.fn()
    km.registerShortcut(['$mod', 'k'], handler)
    fireKey('j', { metaKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it('supports ctrl as $mod', () => {
    const handler = vi.fn()
    km.registerShortcut(['$mod', 'k'], handler)
    fireKey('k', { ctrlKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('unregisters shortcut via returned cleanup fn', () => {
    const handler = vi.fn()
    const unregister = km.registerShortcut(['$mod', 'k'], handler)
    unregister()
    fireKey('k', { metaKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it('fires sequence shortcut g → h', () => {
    vi.useFakeTimers()
    const handler = vi.fn()
    km.registerShortcut(['g', 'h'], handler)
    fireKey('g')
    fireKey('h')
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not fire sequence if timeout expires between keys', () => {
    vi.useFakeTimers()
    const handler = vi.fn()
    km.registerShortcut(['g', 'h'], handler)
    fireKey('g')
    vi.advanceTimersByTime(600)
    fireKey('h')
    expect(handler).not.toHaveBeenCalled()
  })

  it('stop() removes the listener', () => {
    const handler = vi.fn()
    km.registerShortcut(['$mod', 'k'], handler)
    km.stop()
    fireKey('k', { metaKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it('start() is idempotent — does not double-register', () => {
    const handler = vi.fn()
    km.registerShortcut(['$mod', 'k'], handler)
    km.start()
    km.start()
    fireKey('k', { metaKey: true })
    expect(handler).toHaveBeenCalledOnce()
  })
})
