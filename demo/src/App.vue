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
          <kbd>{{ hotkeyDisplay }}</kbd> to open ·<kbd>↑↓</kbd> navigate · <kbd>↵</kbd> execute · <kbd>Esc</kbd> close
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
      empty-text="No commands found. Try 'theme', 'export' or 'settings'."
    >
      <template #trigger="{ toggle: t }">
        <!-- trigger is handled via sidebar button, but slot must exist -->
        <span style="display:none" @click="t" />
      </template>

      <template #item="{ command, active, matches }">
        <div class="custom-item" :class="{ 'custom-item--active': active }">
          <span v-if="command.icon" class="custom-item__icon">{{ command.icon }}</span>
          <span class="custom-item__body">
            <span class="custom-item__label">
              <component :is="highlight(command.label, matches)" />
            </span>
            <span v-if="command.description" class="custom-item__desc">{{ command.description }}</span>
          </span>
          <span v-if="command.shortcut?.length" class="custom-item__shortcut">
            <kbd v-for="k in command.shortcut" :key="k">{{ formatKey(k) }}</kbd>
          </span>
          <span v-if="command.subCommands?.length" class="custom-item__arrow">›</span>
        </div>
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { CommandPalette, highlightMatches, useCommandPalette, useRegisterGroup } from '@macrulez/vue-command-palette'
import type { SearchResult } from '@macrulez/vue-command-palette'
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

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
const modKey = isMac ? '⌘' : 'Ctrl'
const hotkeyDisplay = isMac ? '⌘K' : 'Ctrl + K'

// Register all command groups with auto-cleanup
const groups = buildCommands(page, theme, notifications, toast)
for (const group of groups) {
  useRegisterGroup(group)
}

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
  { icon: '✅', title: 'Confirmation Step', desc: 'confirm: string shows a yes/no dialog before execution.', code: "confirm: 'Are you sure?'" },
  { icon: '⏳', title: 'Loading State', desc: 'Spinner on the item while async perform() is running.', code: 'perform: async () => { ... }' },
  { icon: '🕐', title: 'Recent Commands', desc: 'localStorage persistence of the last N executed commands.', code: 'persistRecent: true, maxRecent: 6' },
  { icon: '🎨', title: 'CSS Custom Properties', desc: '20+ CSS variables for full theme customization.', code: '--vcp-dialog-bg, --vcp-item-active-bg, ...' },
  { icon: '🧩', title: 'Headless Slots', desc: '#item, #group-header, #empty, #header, #footer, #trigger.', code: '<CommandPalette><template #item="{ command }">' },
  { icon: '🔒', title: 'enabled() Guard', desc: 'Dynamic command availability evaluated on every render.', code: 'enabled: () => currentUser.isAdmin' },
  { icon: '🧪', title: 'Testing Utilities', desc: 'createPaletteContext + PaletteProvider for unit tests.', code: 'import { createPaletteContext } from "@macrulez/vue-command-palette/testing"' },
]

function highlight(label: string, matches: SearchResult['matches']) {
  return highlightMatches(label, matches)
}

function formatKey(key: string): string {
  if (key === '$mod') return modKey
  if (key === 'shift') return '⇧'
  if (key === 'alt') return isMac ? '⌥' : 'Alt'
  return key.toUpperCase()
}
</script>
