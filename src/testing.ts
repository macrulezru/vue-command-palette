import { computed, defineComponent, provide as vueProvide, ref } from 'vue'
import { createCommandStore } from './core/CommandStore'
import { createKeyboardManager } from './core/KeyboardManager'
import { PALETTE_INJECT_KEY, PALETTE_REGISTRY_KEY } from './types'
import type { Command, CommandGroup, CommandUsage, PaletteOptions, SearchResult } from './types'
import type { PaletteContext } from './core/useCommandPalette'

export interface PaletteTestOptions extends PaletteOptions {
  commands?: Command[]
  groups?: CommandGroup[]
}

/**
 * Creates a palette context for use in unit tests.
 * Pass `provide` to Vue Test Utils `mount({ global: { provide } })`.
 *
 * @example
 * const { provide } = createPaletteContext({ commands: [myCmd] })
 * const wrapper = mount(MyComponent, { global: { provide } })
 */
export function createPaletteContext(options: PaletteTestOptions = {}) {
  const {
    commands = [],
    groups = [],
    persistRecent = false,
    maxRecent = 5,
    maxRecentPerGroup = 0,
    localStorageKey = 'vcp:recent:test',
    frecency = false,
    showDisabled = false,
    onSearch: globalSearch,
    onOpen,
    onClose,
    onError,
    onHighlight,
  } = options

  const store = createCommandStore(undefined, true, undefined, showDisabled)
  const keyboard = createKeyboardManager()

  if (commands.length) store.registerCommands(commands)
  for (const group of groups) store.registerGroup(group)

  const isOpen = ref(false)
  const query = ref('')
  const activeIndex = ref(0)
  const history = ref<Array<{ paletteId: string; query: string; activeIndex: number }>>([])
  const recentIds = ref<string[]>([])
  const loadingCommandId = ref<string | null>(null)
  const colorTheme = ref<'light' | 'dark' | 'system'>('system')
  const results = computed(() => store.search(query.value))
  const currentResults = ref<SearchResult[]>([])
  const executeRequest = ref<((cmd: Command) => void) | null>(null)
  const usage = ref<Record<string, CommandUsage>>({})
  const pinnedIds = ref<string[]>([])
  const queryHistory = ref<string[]>([])

  const ctx: PaletteContext = {
    store, keyboard,
    isOpen, query, activeIndex, history, recentIds, loadingCommandId, results,
    currentResults,
    executeRequest,
    colorTheme,
    persistRecent, maxRecent, maxRecentPerGroup, localStorageKey,
    frecency, usage, pinnedIds, queryHistory, showDisabled, globalSearch,
    onOpen, onClose, onError, onHighlight,
  }

  const registry = new Map<string, PaletteContext>([['default', ctx]])

  return {
    ctx,
    store,
    isOpen,
    query,
    activeIndex,
    provide: {
      [PALETTE_INJECT_KEY as unknown as string]: ctx,
      [PALETTE_REGISTRY_KEY as unknown as string]: registry,
    },
  }
}

/**
 * Wrapper component that provides palette context to its slot children.
 * Useful for component tree tests.
 *
 * @example
 * mount(PaletteProvider, {
 *   props: { commands: [myCmd] },
 *   slots: { default: MyComponent },
 * })
 */
export const PaletteProvider = defineComponent({
  name: 'PaletteProvider',
  props: {
    commands: { type: Array as () => Command[], default: () => [] },
    groups: { type: Array as () => CommandGroup[], default: () => [] },
  },
  setup(props, { slots }) {
    const { ctx } = createPaletteContext({
      commands: props.commands,
      groups: props.groups,
    })
    vueProvide(PALETTE_INJECT_KEY, ctx)
    return () => slots.default?.()
  },
})
