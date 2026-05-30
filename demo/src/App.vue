<script setup lang="ts">
import { computed, ref } from 'vue'
import { CommandPalette, fuzzySearch, useCommandPalette, useRegisterCommands, useRegisterGroup } from '@macrulez/vue-command-palette'
import type { Command, PaletteLabels } from '@macrulez/vue-command-palette'
import { buildCommands } from './commands'

const page = ref('dashboard')
const theme = ref<'light' | 'dark' | 'system'>('system')
const notifications = ref(true)

// Toast
const toastMsg = ref('')
const toastType = ref<'info' | 'success' | 'error'>('info')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function toast(msg: string, type: 'info' | 'success' | 'error' = 'info') {
  toastMsg.value = msg
  toastType.value = type
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 3000)
}

const { toggle } = useCommandPalette()
const { toggle: toggleQuick } = useCommandPalette('quick')

const uaPlatform = typeof navigator !== 'undefined'
  ? ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || '')
  : ''
const isMac = /mac/i.test(uaPlatform)
const modKey = isMac ? '⌘' : 'Ctrl'
const hotkeyDisplay = isMac ? '⌘K' : 'Ctrl + K'
const quickHotkeyDisplay = isMac ? '⌥J' : 'Alt + J'

// Register all command groups with auto-cleanup (default instance)
const groups = buildCommands(page, theme, notifications, toast)
for (const group of groups) {
  useRegisterGroup(group)
}

// Commands for the second, named "quick" instance
useRegisterCommands([
  { id: 'q-dashboard', label: 'Dashboard', icon: '🏠', perform: () => { page.value = 'dashboard'; toast('Quick: Dashboard') } },
  { id: 'q-projects', label: 'Projects', icon: '📁', perform: () => { page.value = 'projects'; toast('Quick: Projects') } },
  { id: 'q-analytics', label: 'Analytics', icon: '📊', perform: () => { page.value = 'analytics'; toast('Quick: Analytics') } },
  { id: 'q-team', label: 'Team', icon: '👥', perform: () => { page.value = 'team'; toast('Quick: Team') } },
], 'quick')

// Custom labels for the quick instance (localization demo)
const quickLabels: Partial<PaletteLabels> = {
  recent: 'Недавние',
  dialogLabel: 'Quick instance',
}

// All commands flattened (top-level + nested), for the ">" mode below
function flattenCommands(cmds: Command[], out: Command[] = []): Command[] {
  for (const c of cmds) {
    out.push(c)
    if (c.subCommands?.length) flattenCommands(c.subCommands, out)
  }
  return out
}
const allCommandsFlat = flattenCommands(groups.flatMap(g => g.commands))

// Prefix modes: ">" runs commands by NAME only, "@" searches people (async)
const people = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Linus Torvalds', 'Margaret Hamilton', 'Dennis Ritchie']
const paletteModes = [
  {
    prefix: '>',
    label: 'Commands',
    placeholder: 'Run a command…',
    // Match by command name only — proxy with just the label, then map back.
    onSearch: (q: string) => {
      const proxies = allCommandsFlat.map(c => ({ id: c.id, label: c.label, perform: c.perform }))
      return fuzzySearch(q, proxies).map(r => allCommandsFlat.find(c => c.id === r.command.id)!)
    },
  },
  {
    prefix: '@',
    label: 'People',
    placeholder: 'Search people…',
    onSearch: async (q: string) => {
      await new Promise(r => setTimeout(r, 250))
      return people
        .filter(p => p.toLowerCase().includes(q.toLowerCase()))
        .map(p => ({ id: `person-${p}`, label: p, icon: '🧑‍💻', description: 'Open profile', perform: () => toast(`Opening ${p}`, 'info') }))
    },
  },
]

// Nav items
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'team', label: 'Team', icon: '👥' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

const currentPage = computed(() => navItems.find(n => n.id === page.value))

// Feature list
const features = [
  { icon: '🔍', title: 'Fuzzy Search', desc: 'Ranking: exact → prefix → contains → fuzzy. Diacritic normalization included.', code: 'fuzzySearch(query, commands)' },
  { icon: '⌨️', title: 'Keyboard Manager', desc: 'Global hotkeys, $mod (Cmd/Ctrl), key sequences like g→h.', code: "registerShortcut(['$mod', 'k'], handler)" },
  { icon: '🗂️', title: 'Grouped Commands', desc: 'Groups with headers, priorities and section dividers.', code: 'registerGroup({ id, label, priority, commands })' },
  { icon: '🔄', title: 'Async Search', desc: 'onSearch with debounce — fetch results from external sources.', code: 'onSearch: (query) => Promise<Command[]>' },
  { icon: '🪆', title: 'Nested Palettes', desc: 'subCommands opens a nested palette with breadcrumb trail.', code: 'subCommands: [{ id, label, perform }]' },
  { icon: '📄', title: 'Command Pages', desc: 'A command can open a page with its own placeholder and async search. Try "Assign to user…".', code: 'page: { placeholder, onSearch }' },
  { icon: '⚡', title: 'Bindable Shortcuts', desc: 'bindShortcuts turns each command shortcut into a real global hotkey. Try Alt+N / Alt+C.', code: 'app.use(plugin, { bindShortcuts: true })' },
  { icon: '🔱', title: 'Multiple Instances', desc: 'Run several independent palettes — this demo has a quick switcher on Alt+J.', code: 'createCommandPalette({ name: "quick" })' },
  { icon: '🌍', title: 'Localization', desc: 'Override every UI string via the labels prop (the quick switcher is in Russian).', code: ':labels="{ recent: \'Недавние\' }"' },
  { icon: '🔌', title: 'Pluggable Search', desc: 'Swap the built-in scorer for your own, e.g. Fuse.js.', code: 'app.use(plugin, { search: customFn })' },
  { icon: '📈', title: 'Frecency', desc: 'Frequently & recently used commands float to the top.', code: 'app.use(plugin, { frecency: true })' },
  { icon: '🔭', title: 'Modes / scopes', desc: 'Prefix the query to switch scope. Try ">" (commands) or "@" (people).', code: ":modes=\"[{ prefix: '@', onSearch }]\"" },
  { icon: '📌', title: 'Pinned', desc: 'Pin the active command with Cmd/Ctrl+P — it appears in a Pinned section.', code: 'togglePin(id) · $mod+P' },
  { icon: '⚡', title: 'Secondary actions', desc: 'Press Tab on “Export Data” to open its actions menu.', code: 'actions: [{ id, label, perform }]' },
  { icon: '🕰️', title: 'Query history', desc: 'Recall previous queries with Alt+ArrowUp / Alt+ArrowDown.', code: 'Alt + ↑ / ↓' },
  { icon: '🖼️', title: 'Preview pane', desc: 'Side panel previews the active command + its info (HTML). Toggle with the panel icon or Cmd/Ctrl+I.', code: 'info: "<b>HTML</b>" · $mod+I' },
  { icon: '📱', title: 'Responsive / touch', desc: 'Full-width on mobile, bigger touch targets, swipe right to go back.', code: '@media (max-width: 640px)' },
  { icon: '🧬', title: 'Typed data', desc: 'Attach a type-safe payload to commands via the generic Command<T>.', code: 'useRegisterCommands<UserData>([...])' },
  { icon: '🚫', title: 'Show disabled', desc: 'Disabled commands stay visible (greyed, non-executable) with a reason tooltip — search "disabled".', code: 'app.use(plugin, { showDisabled: true })' },
  { icon: '✅', title: 'Confirmation Step', desc: 'confirm: string shows a yes/no dialog before execution.', code: "confirm: 'Are you sure?'" },
  { icon: '⏳', title: 'Loading State', desc: 'Spinner on the item while async perform() is running.', code: 'perform: async () => { ... }' },
  { icon: '🕐', title: 'Recent Commands', desc: 'localStorage persistence of the last N executed commands.', code: 'persistRecent: true, maxRecent: 6' },
  { icon: '🎨', title: 'CSS Custom Properties', desc: '20+ CSS variables for full theme customization.', code: '--vcp-dialog-bg, --vcp-item-active-bg, ...' },
  { icon: '🧩', title: 'Headless Slots', desc: '#item, #group-header, #empty, #header, #footer, #trigger.', code: '<CommandPalette><template #item="{ command }">' },
  { icon: '🔒', title: 'enabled() Guard', desc: 'Dynamic command availability evaluated on every render.', code: 'enabled: () => currentUser.isAdmin' },
  { icon: '🧪', title: 'Testing Utilities', desc: 'createPaletteContext + PaletteProvider for unit tests.', code: 'import { createPaletteContext } from "@macrulez/vue-command-palette/testing"' },
]

function formatKey(key: string): string {
  if (key === '$mod') return modKey
  if (key === 'shift') return '⇧'
  if (key === 'alt') return isMac ? '⌥' : 'Alt'
  return key.toUpperCase()
}
</script>

<template>
  <div class="app" :data-theme="theme">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar__logo">⌘ Demo</div>
      <nav class="sidebar__nav">
        <button
          v-for="item in navItems"
          :key="item.id"
          class="sidebar__link"
          :class="{ 'sidebar__link--active': page === item.id }"
          @click="page = item.id"
        >
          <span class="sidebar__icon">{{ item.icon }}</span>
          {{ item.label }}
        </button>
      </nav>
      <div class="sidebar__footer">
        <button class="trigger-btn" @click="toggle">
          <span>Search / Commands</span>
          <kbd class="hotkey">{{ hotkeyDisplay }}</kbd>
        </button>
        <button class="trigger-btn trigger-btn--ghost" @click="toggleQuick">
          <span>Quick switch</span>
          <kbd class="hotkey">{{ quickHotkeyDisplay }}</kbd>
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <main class="content">
      <header class="topbar">
        <h1 class="topbar__title">{{ currentPage?.label }}</h1>
        <div class="topbar__actions">
          <span class="badge" :class="`badge--${theme}`">theme: {{ theme }}</span>
          <span class="badge" :class="notifications ? 'badge--success' : 'badge--muted'">
            {{ notifications ? '🔔 on' : '🔕 off' }}
          </span>
        </div>
      </header>

      <div class="page-body">
        <!-- Feature cards -->
        <div class="features">
          <div v-for="f in features" :key="f.title" class="feature-card">
            <div class="feature-card__icon">{{ f.icon }}</div>
            <div class="feature-card__body">
              <h3>{{ f.title }}</h3>
              <p>{{ f.desc }}</p>
              <code>{{ f.code }}</code>
            </div>
          </div>
        </div>

        <!-- Hint -->
        <div class="hint">
          <kbd>{{ hotkeyDisplay }}</kbd> commands · <kbd>{{ quickHotkeyDisplay }}</kbd> quick switch · <kbd>Tab</kbd> actions · <kbd>{{ modKey }} + P</kbd> pin · <kbd>Alt + ↑</kbd> history · <kbd>{{ modKey }} + I</kbd> preview · <kbd>↑↓</kbd> navigate
        </div>
      </div>
    </main>

    <!-- Toast notifications -->
    <Transition name="toast">
      <div v-if="toastMsg" class="toast" :class="`toast--${toastType}`">
        {{ toastMsg }}
      </div>
    </Transition>

    <!-- Command Palette -->
    <CommandPalette
      placeholder="Search commands…"
      :max-results="12"
      group-recent
      preview
      :modes="paletteModes"
      empty-text="No commands found. Try 'theme', 'export' or 'settings'."
    >
      <template #trigger="{ toggle: t }">
        <!-- trigger is handled via sidebar button, but slot must exist -->
        <span style="display:none" @click="t" />
      </template>

      <template #preview="{ command }">
        <div v-if="command" class="preview">
          <div class="preview__icon">{{ command.icon || '⌘' }}</div>
          <h3 class="preview__title">{{ command.label }}</h3>
          <p v-if="command.description" class="preview__desc">{{ command.description }}</p>
          <div v-if="command.shortcut?.length" class="preview__row">
            <span class="preview__key">Shortcut</span>
            <span><kbd v-for="k in command.shortcut" :key="k">{{ formatKey(k) }}</kbd></span>
          </div>
          <div v-if="command.keywords?.length" class="preview__row">
            <span class="preview__key">Keywords</span>
            <span>{{ command.keywords.join(', ') }}</span>
          </div>
          <div v-if="command.subCommands?.length || command.page" class="preview__row">
            <span class="preview__key">Opens</span>
            <span>{{ command.page ? 'a page' : command.subCommands.length + ' sub-commands' }}</span>
          </div>
          <div v-if="command.data" class="preview__row">
            <span class="preview__key">Data</span>
            <span>{{ JSON.stringify(command.data) }}</span>
          </div>
        </div>
        <div v-else class="preview preview--empty">Select a command to preview</div>
      </template>

      <template #footer>
        <div class="palette-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>Esc</kbd> close</span>
          <span><kbd>⌫</kbd> back</span>
        </div>
      </template>
    </CommandPalette>

    <!-- Second, independent named instance (quick switcher) -->
    <CommandPalette
      name="quick"
      placeholder="Quick instance…"
      :labels="quickLabels"
      :max-results="6"
      empty-text="Not found."
    />
  </div>
</template>
