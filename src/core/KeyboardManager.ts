type Handler = () => void

interface RegisteredShortcut {
  keys: string[]
  handler: Handler
}

const MODIFIERS = new Set(['shift', 'ctrl', 'meta', 'alt', '$mod'])

function isModifier(key: string): boolean {
  return MODIFIERS.has(key)
}

function isSequenceShortcut(keys: string[]): boolean {
  return keys.length >= 2 && keys.every(k => !isModifier(k))
}

function hasCtrlOrMeta(keys: string[]): boolean {
  return keys.some(k => k === '$mod' || k === 'ctrl' || k === 'meta')
}

function isEditableTarget(event: KeyboardEvent): boolean {
  const el = event.target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  const attr = el.getAttribute?.('contenteditable')
  return attr === '' || attr === 'true'
}

function normalizeKey(key: string, event: KeyboardEvent): boolean {
  if (key === '$mod') return event.metaKey || event.ctrlKey
  if (key === 'shift') return event.shiftKey
  if (key === 'alt') return event.altKey
  if (key === 'ctrl') return event.ctrlKey
  if (key === 'meta') return event.metaKey
  return event.key.toLowerCase() === key.toLowerCase()
}

function matchesHotkeyShortcut(keys: string[], event: KeyboardEvent): boolean {
  const modifiers = keys.slice(0, -1)
  const mainKey = keys[keys.length - 1]

  for (const mod of modifiers) {
    if (!normalizeKey(mod, event)) return false
  }

  if (!modifiers.includes('$mod') && !modifiers.includes('ctrl') && !modifiers.includes('meta')) {
    if (event.ctrlKey || event.metaKey) return false
  }
  if (!modifiers.includes('shift') && event.shiftKey) return false
  if (!modifiers.includes('alt') && event.altKey) return false

  return event.key.toLowerCase() === mainKey.toLowerCase()
}

export function createKeyboardManager() {
  const shortcuts: RegisteredShortcut[] = []
  let sequenceBuffer: string[] = []
  let sequenceTimer: ReturnType<typeof setTimeout> | null = null
  let listening = false

  function handleKeyDown(event: KeyboardEvent) {
    const editable = isEditableTarget(event)

    // 1. Try modifier-based hotkeys first.
    //    Plain-key / shift-only hotkeys are ignored while typing in a field;
    //    Ctrl/Meta combos (e.g. $mod+k) still fire so the palette can be opened.
    for (const { keys, handler } of shortcuts) {
      if (isSequenceShortcut(keys)) continue
      if (editable && !hasCtrlOrMeta(keys)) continue
      if (matchesHotkeyShortcut(keys, event)) {
        event.preventDefault()
        handler()
        return
      }
    }

    // 2. Handle bare-key sequences like ['g', 'h'] — never while typing in a field
    if (editable) return
    const seqShortcuts = shortcuts.filter(s => isSequenceShortcut(s.keys))
    if (!seqShortcuts.length) return
    if (event.metaKey || event.ctrlKey || event.altKey) return

    sequenceBuffer.push(event.key.toLowerCase())
    if (sequenceTimer) clearTimeout(sequenceTimer)
    sequenceTimer = setTimeout(() => { sequenceBuffer = [] }, 500)

    const buf = sequenceBuffer
    for (const { keys, handler } of seqShortcuts) {
      const needed = keys.map(k => k.toLowerCase())
      if (buf.length >= needed.length) {
        const tail = buf.slice(-needed.length)
        if (tail.every((k, i) => k === needed[i])) {
          event.preventDefault()
          sequenceBuffer = []
          handler()
          return
        }
      }
    }
  }

  function registerShortcut(keys: string[], handler: Handler): () => void {
    const entry: RegisteredShortcut = { keys, handler }
    shortcuts.push(entry)
    return () => {
      const idx = shortcuts.indexOf(entry)
      if (idx !== -1) shortcuts.splice(idx, 1)
    }
  }

  function start() {
    if (listening || typeof document === 'undefined') return
    listening = true
    document.addEventListener('keydown', handleKeyDown)
  }

  function stop() {
    if (typeof document === 'undefined') return
    listening = false
    document.removeEventListener('keydown', handleKeyDown)
  }

  return { registerShortcut, start, stop }
}

export type KeyboardManager = ReturnType<typeof createKeyboardManager>
