<div align="center" style="background:#111827;border-radius:20px;padding:28px 20px 20px;margin-bottom:32px">
  <h1 style="color:#f9fafb;margin:0 0 32px;font-size:2.2em;letter-spacing:-0.03em;font-weight:700;font-family:sans-serif">
    @macrulez/vue-command-palette
  </h1>
  <img
    src="https://s3.twcstorage.ru/c9a2cc89-780f97fd-311d-4a1a-b86f-c25665c9dc46/images/npm/vue-command-palette.webp"
    alt="vue-virtual-scroller-kit"
    style="max-width:100%;width:auto;height:300px;border-radius:12px"
  />
</div>

Command+K palette for Vue 3. Fuzzy search with match highlighting, grouped commands, nested sub-palettes, global keyboard shortcuts, async search, confirmation dialogs, recent command history, and full headless customisation via slots — all with a single peer dependency (Vue 3).

---

## Contents

- [Features](#features)
- [Demo](#demo)
- [Installation](#installation)
- [Quick start](#quick-start)
- [CommandPalette](#commandpalette)
- [CommandItem](#commanditem)
- [CommandGroup](#commandgroup)
- [useCommandPalette](#usecommandpalette)
- [useRegisterCommands](#useregistercommands)
- [useRegisterGroup](#useregistergroup)
- [VCommandPalettePlugin](#vcommandpaletteplugin)
- [Command type](#command-type)
- [Fuzzy search](#fuzzy-search)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Nested palettes](#nested-palettes)
- [Confirmation step](#confirmation-step)
- [Async search](#async-search)
- [Recent commands](#recent-commands)
- [Preview pane](#preview-pane)
- [Mobile / touch](#mobile--touch)
- [Pinned commands](#pinned-commands)
- [Secondary actions](#secondary-actions)
- [Multi-select](#multi-select)
- [Query history](#query-history)
- [Frecency](#frecency)
- [Modes / scopes](#modes--scopes)
- [Typed command data](#typed-command-data)
- [Custom search strategy](#custom-search-strategy)
- [Binding shortcuts](#binding-shortcuts)
- [Command pages](#command-pages)
- [Multiple instances](#multiple-instances)
- [Theming](#theming)
- [Localization](#localization)
- [Nuxt](#nuxt)
- [Testing utilities](#testing-utilities)
- [TypeScript types](#typescript-types)
- [Accessibility](#accessibility)
- [SSR compatibility](#ssr-compatibility)
- [Bundle size](#bundle-size)

---

## Features

- **Fuzzy search** — ranking: exact (100) › prefix (80) › substring (60) › fuzzy (1–40). Searches label, `description`, `keywords` and `aliases`; label highlighting is preserved even when another field wins the score. Diacritic normalization so `café` matches `cafe`. Match highlighting via `<mark>` spans.
- **Pluggable search** — swap the built-in scorer for your own (e.g. Fuse.js) via the `search` option.
- **Bindable shortcuts** — `bindShortcuts: true` turns each command's `shortcut` into a real global hotkey.
- **Searchable nested commands** — sub-commands surface directly in search with breadcrumb context (`Change Theme › Light`); a `›` chevron marks items that open a sub-palette/page.
- **Command pages** — a command can open a `page` with its own placeholder and async search (filters, remote pickers, multi-step flows).
- **Multiple instances** — run several independent, named palettes on one app via `createCommandPalette()`.
- **All-commands view** — palette shows all registered commands grouped on open; no empty screen.
- **Grouped commands** — groups with headers, priority ordering, and visual section dividers.
- **Recent commands** — `localStorage`-backed history of the last N executed commands shown at the top when the query is empty.
- **Nested palettes** — `subCommands` opens a child palette with breadcrumb trail; `Backspace` / `Esc` navigates back.
- **Async search** — `onSearch: (query) => Promise<Command[]>` per group, debounced 200 ms, merged with sync results.
- **Confirmation step** — `confirm: string` shows a yes/no dialog before the command executes.
- **Loading state** — spinner on the item while an async `perform()` is running.
- **`enabled()` guard** — dynamic command availability evaluated on every render cycle.
- **Aliases & keywords** — searched alongside the label; aliases score identically to label matches.
- **Global keyboard manager** — `$mod` (⌘ on macOS, Ctrl on Windows/Linux), modifier combinations, bare-key sequences (`g` → `h` within 500 ms).
- **Headless slots** — `#trigger`, `#header`, `#input`, `#item`, `#group-header`, `#empty`, `#footer` for complete UI control.
- **20+ CSS custom properties** — full theme customisation without touching source code. Automatic dark mode via `prefers-color-scheme`.
- **Custom scrollbar** — thin 4 px scrollbar styled to match the palette theme.
- **Virtual list** — own implementation for result sets > 50 items, no extra dependencies.
- **Nuxt module** — auto-installs the plugin via `nuxt.config.ts`.
- **Testing utilities** — `createPaletteContext` + `PaletteProvider` for isolated unit tests.
- **SSR-safe** — all browser API calls guarded with `typeof document !== 'undefined'`.
- **Zero runtime dependencies** — only Vue 3 as peer dep. ~11 KB gzip.

---

## Demo

```bash
cd demo
npm install
npm run dev
```

Opens at **http://localhost:5173**.

---

## Installation

```bash
npm install @macrulez/vue-command-palette
```

Peer dependency:

```bash
npm install vue@>=3.3
```

---

## Quick start

### 1. Install the plugin

```ts
// main.ts
import { createApp } from 'vue'
import { VCommandPalettePlugin } from '@macrulez/vue-command-palette'
import '@macrulez/vue-command-palette/style.css'
import App from './App.vue'

const app = createApp(App)

app.use(VCommandPalettePlugin, {
  hotkey: ['$mod', 'k'],  // Cmd+K on macOS, Ctrl+K on Windows/Linux
  colorTheme: 'system',   // 'light' | 'dark' | 'system'
  persistRecent: true,
  maxRecent: 5,
})

app.mount('#app')
```

### 2. Place `CommandPalette` anywhere in your component tree

```vue
<script setup lang="ts">
import { CommandPalette, useRegisterGroup } from '@macrulez/vue-command-palette'

useRegisterGroup({
  id: 'navigation',
  label: 'Navigation',
  priority: 100,
  commands: [
    {
      id: 'go-home',
      label: 'Go to Home',
      icon: '🏠',
      perform: () => router.push('/'),
    },
    {
      id: 'go-settings',
      label: 'Settings',
      icon: '⚙️',
      shortcut: ['$mod', ','],
      perform: () => router.push('/settings'),
    },
  ],
})
</script>

<template>
  <RouterView />
  <CommandPalette placeholder="Search commands…" :max-results="12" />
</template>
```

Press **Cmd+K** / **Ctrl+K** to open.

---

## CommandPalette

The root component. Renders a modal overlay with a search input, result list, and optional slots. Teleports to `<body>` by default.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | — | Target a specific named palette instance (default singleton when omitted) |
| `placeholder` | `string` | `'Search commands…'` | Input placeholder text |
| `maxResults` | `number` | `10` | Maximum number of results shown |
| `emptyText` | `string` | `'No commands found.'` | Text shown when search returns nothing |
| `loadingText` | `string` | `'Loading…'` | Text shown while async groups are fetching |
| `teleportTo` | `string` | `'body'` | CSS selector for the `<Teleport>` target |
| `theme` | `'default' \| 'compact'` | `'default'` | Compact uses a narrower, shorter dialog |
| `animationDuration` | `number` | `150` | Fade transition duration in ms |
| `labels` | `Partial<PaletteLabels>` | — | Override built-in UI strings (i18n) — see [Localization](#localization) |
| `groupRecent` | `boolean` | `false` | Cluster recent commands by their `group` with sub-headers |
| `modes` | `PaletteMode[]` | — | Prefix-activated search scopes (see [Modes / scopes](#modes--scopes)) |
| `selectable` | `boolean` | `false` | Multi-select mode (see [Multi-select](#multi-select)) |
| `preview` | `boolean` | `false` | Show a preview pane for the active command (see [Preview pane](#preview-pane)) |
| `previewHotkey` | `string[]` | `['$mod', 'i']` | Key combo to toggle the preview pane (`[]` to disable) |

### Emits

| Event | Payload | Description |
|---|---|---|
| `submit-selection` | `Command[]` | Emitted on `$mod+Enter` in [multi-select](#multi-select) mode |

### Slots

| Slot | Scope | Description |
|---|---|---|
| `#trigger` | `{ open, toggle }` | Custom element that opens the palette |
| `#header` | — | Content inserted above the search input |
| `#input` | `{ query, onInput }` | Replace the default `<input>` entirely |
| `#item` | `{ command, active, matches, parents, matchedText }` | Replace the entire result row (`parents` = breadcrumb context; `matchedText` = matching keyword/alias) |
| `#group-header` | `{ group }` | Replace the group label row |
| `#empty` | `{ query }` | Shown when the query returns no results |
| `#actions` | `{ command, run, activeIndex, close }` | Replace the secondary-actions menu |
| `#preview` | `{ command }` | Preview pane content for the active command (requires `preview` prop) |
| `#footer` | — | Content below the result list |

### Custom `#item` slot

```vue
<CommandPalette>
  <template #item="{ command, active, matches }">
    <div :class="['my-item', { 'my-item--active': active }]">
      <span v-if="command.icon" class="my-item__icon">{{ command.icon }}</span>

      <span class="my-item__body">
        <component :is="highlightMatches(command.label, matches)" />
        <span v-if="command.description" class="my-item__desc">
          {{ command.description }}
        </span>
      </span>

      <span v-if="command.shortcut?.length" class="my-item__shortcut">
        <kbd v-for="k in command.shortcut" :key="k">{{ k }}</kbd>
      </span>

      <span v-if="command.subCommands?.length">›</span>
    </div>
  </template>
</CommandPalette>
```

### Custom `#footer` slot

```vue
<CommandPalette>
  <template #footer>
    <div class="my-footer">
      <span><kbd>↑↓</kbd> navigate</span>
      <span><kbd>↵</kbd> select</span>
      <span><kbd>Esc</kbd> close</span>
    </div>
  </template>
</CommandPalette>
```

### Programmatic trigger via `#trigger` slot

```vue
<CommandPalette>
  <template #trigger="{ toggle }">
    <button @click="toggle">Open palette</button>
  </template>
</CommandPalette>
```

---

## CommandItem

Renders a single command row with icon, label (with match highlighting), description, shortcut badge, loading spinner, and disabled state. Used internally; also available for custom layouts.

### Props

| Prop | Type | Description |
|---|---|---|
| `command` | `Command` | The command to render |
| `active` | `boolean` | Whether this row is keyboard-selected |
| `matches` | `Array<[number, number]>` | Highlight ranges from the fuzzy search engine |
| `itemId` | `string` | `id` attribute for ARIA `aria-activedescendant` |
| `loadingCommandId` | `string \| null` | ID of the currently executing command; shows spinner |

### Emits

| Event | Description |
|---|---|
| `execute` | User clicked or pressed Enter on this item |
| `activate` | User hovered over this item |

---

## CommandGroup

Renders a group header followed by its `CommandItem` rows. Passes all `#item`, `#item-icon`, and `#item-shortcut` slots through to each child.

### Props

| Prop | Type | Description |
|---|---|---|
| `group` | `CommandGroup` | Group metadata (`id`, `label`, `priority`) |
| `items` | `SearchResult[]` | Filtered results for this group |
| `activeIndex` | `number` | Global active index for highlight tracking |
| `globalOffset` | `number` | Index offset within the flat result list |
| `loadingCommandId` | `string \| null` | Forwarded to each `CommandItem` |

---

## useCommandPalette

Composable that exposes the global palette state and all control functions. Must be called inside a component tree where `VCommandPalettePlugin` is installed. Pass an instance name — `useCommandPalette('sidebar')` — to target a [named instance](#multiple-instances).

```ts
import { useCommandPalette } from '@macrulez/vue-command-palette'

const {
  isOpen,            // Readonly<Ref<boolean>>
  query,             // Ref<string>
  results,           // ComputedRef<SearchResult[]>
  activeIndex,       // Ref<number>
  history,           // Readonly<Ref<HistoryEntry[]>>
  loadingCommandId,  // Readonly<Ref<string | null>>

  open,              // (paletteId?: string) => void
  close,             // () => void
  toggle,            // () => void
  goBack,            // () => void — pop history, or close if empty
  executeCommand,    // (cmd: Command) => Promise<void>
  executeActive,     // () => Promise<void> — run the currently selected result
  getRecentCommands, // () => Command[]
  getPinnedCommands, // () => Command[]
  registerCommands,  // (commands: Command[]) => () => void
  registerGroup,     // (group: CommandGroup) => () => void
  addRecent,         // (id: string) => void
  pin, unpin, togglePin, isPinned,  // pinned commands API
  pinnedIds,         // Readonly<Ref<string[]>>
  queryHistory,      // Readonly<Ref<string[]>>
} = useCommandPalette()
```

### Programmatic control

```ts
const { open, close, toggle } = useCommandPalette()

open()    // open the palette
close()   // close and reset state
toggle()  // toggle open/close

// Push a sub-palette (breadcrumb navigation)
open('parent-command-id')
```

---

## useRegisterCommands

Registers commands when the component mounts and automatically unregisters them when it unmounts. Commands registered this way have no group header.

```ts
import { useRegisterCommands } from '@macrulez/vue-command-palette'

// In any component setup()
useRegisterCommands([
  {
    id: 'format-doc',
    label: 'Format Document',
    icon: '✨',
    perform: () => formatDocument(),
  },
  {
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    shortcut: ['$mod', 'b'],
    perform: () => sidebar.toggle(),
  },
])
```

---

## useRegisterGroup

Registers a full command group with a label and priority on mount, unregisters on unmount.

```ts
import { useRegisterGroup } from '@macrulez/vue-command-palette'

useRegisterGroup({
  id: 'editor',
  label: 'Editor',
  priority: 80,
  commands: [
    {
      id: 'editor-format',
      label: 'Format Document',
      description: 'Run Prettier on the current file',
      icon: '✨',
      perform: () => format(),
    },
    {
      id: 'editor-lint',
      label: 'Lint File',
      description: 'Run ESLint and show errors',
      icon: '🔍',
      enabled: () => isFileOpen.value,
      perform: () => lint(),
    },
  ],
})
```

---

## VCommandPalettePlugin

The Vue plugin that sets up the global command store, keyboard listener, and reactive state.

```ts
app.use(VCommandPalettePlugin, options)
```

### Options (`PaletteOptions`)

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `'default'` | Instance name (see [Multiple instances](#multiple-instances)) |
| `hotkey` | `string[]` | `['$mod', 'k']` | Key combination to toggle the palette |
| `colorTheme` | `'light' \| 'dark' \| 'system'` | `'system'` | Initial color theme of the palette |
| `search` | `SearchFn` | built-in fuzzy | Custom search strategy (see [Custom search](#custom-search-strategy)) |
| `searchNested` | `boolean` | `true` | Surface nested `subCommands` in search results with breadcrumb context |
| `showDisabled` | `boolean` | `false` | Show disabled commands (greyed, non-executable, demoted) instead of hiding them |
| `frecency` | `boolean` | `false` | Boost frequently & recently used commands in the ranking (see [Frecency](#frecency)) |
| `onSearch` | `(query) => Command[] \| Promise<Command[]>` | — | Plugin-level async data source merged into every query (see [Async search](#async-search)) |
| `bindShortcuts` | `boolean` | `false` | Auto-register each command's `shortcut` as a global hotkey |
| `persistRecent` | `boolean` | `true` | Persist recent commands to `localStorage` |
| `maxRecent` | `number` | `5` | Maximum total recent commands stored |
| `maxRecentPerGroup` | `number` | `0` | Max recent per group (`0` = unlimited) |
| `localStorageKey` | `string` | `'vcp:recent'` | Key used in `localStorage` |
| `onOpen` | `() => void` | — | Called every time the palette opens |
| `onClose` | `() => void` | — | Called every time the palette closes |
| `onError` | `(err: unknown, command: Command) => void` | — | Called when `perform()` throws |
| `onHighlight` | `(command: Command \| null) => void` | — | Called when the keyboard-active command changes (previews/analytics) |

### Example with all options

```ts
app.use(VCommandPalettePlugin, {
  hotkey: ['$mod', 'k'],
  colorTheme: 'system',          // 'light' | 'dark' | 'system'
  persistRecent: true,
  maxRecent: 8,
  maxRecentPerGroup: 2,
  localStorageKey: 'myapp:palette:recent',
  onOpen: () => analytics.track('palette_opened'),
  onClose: () => analytics.track('palette_closed'),
  onError: (err, cmd) => {
    console.error(`Command "${cmd.label}" failed:`, err)
    toast.error(`Failed to run "${cmd.label}"`)
  },
})
```

### `$mod` key

`$mod` resolves to `Meta` (⌘) on macOS and `Ctrl` on Windows / Linux — use it for portable shortcuts:

```ts
hotkey: ['$mod', 'k']             // Cmd+K on Mac, Ctrl+K on Windows
shortcut: ['$mod', 'shift', 'p']  // Cmd+Shift+P on Mac, Ctrl+Shift+P on Windows
```

---

## Command type

```ts
interface Command<T = unknown> {
  id: string                           // unique identifier
  label: string                        // display text, searched by fuzzy engine
  description?: string                 // subtitle shown below the label
  icon?: Component | string            // Vue component or emoji / string
  keywords?: string[]                  // extra search terms
  aliases?: string[]                   // alternate labels (same score as label match)
  shortcut?: string[]                  // display-only hint: ['$mod', 'k']
  disabled?: boolean                   // permanently unavailable
  enabled?: () => boolean              // dynamically disable — evaluated on each render
  disabledReason?: string              // tooltip shown when the command is disabled
  badge?: string | { text: string; color?: string }  // small label (e.g. "New", "Pro")
  confirm?: string                     // prompt shown before execute
  perform: () => void | Promise<void>  // action; may be async
  subCommands?: Command[]              // opens a nested palette when selected
  page?: CommandPage                   // opens a page with its own input/async search
  actions?: CommandAction[]            // secondary actions, opened with Tab
  info?: string                        // text/HTML shown in the preview pane (v-html)
  data?: T                             // type-safe payload (see Typed command data)
}

interface CommandAction {
  id: string
  label: string
  icon?: Component | string
  shortcut?: string[]                  // display-only hint
  perform: () => void | Promise<void>
}

interface CommandPage {
  placeholder?: string                                       // input placeholder on the page
  items?: Command[]                                          // static items (empty query)
  onSearch?: (query: string) => Command[] | Promise<Command[]>  // query-driven results (debounced)
}
```

### `icon` field

Accepts an emoji string, a plain text string, or any Vue component:

```ts
import MyIcon from './MyIcon.vue'

{ icon: '🏠' }           // emoji string
{ icon: '⌘' }            // symbol string
{ icon: MyIcon }          // Vue component — rendered as <MyIcon />
```

---

## Fuzzy search

The built-in `fuzzySearch` function is exported for standalone use:

```ts
import { fuzzySearch, highlightMatches } from '@macrulez/vue-command-palette'

const results = fuzzySearch('git cm', commands)
// sorted by score: exact → prefix → substring → fuzzy

// Render highlighted label in a custom slot
const vnode = highlightMatches(command.label, result.matches)
// returns a VNode: <span>git <mark class="vcp-match">c</mark>o<mark class="vcp-match">m</mark>mit</span>

// Highlight ranges for results that came from an external source
// (async groups, pages, modes — these are already highlighted internally):
import { getMatchRanges } from '@macrulez/vue-command-palette'
const ranges = getMatchRanges('al', 'Alan Turing') // → [[0, 1]]
```

### Scoring table

| Match type | Score |
|---|---|
| Exact match | 100 |
| Prefix match | 80 |
| Substring (contains) | 60 |
| Fuzzy (all chars in order) | 1 – 40 (penalised by character gaps) |
| No match | −1 (excluded from results) |

The engine checks `label`, all `keywords[]`, and all `aliases[]`. The highest score across all fields wins. Commands where `disabled: true` or `enabled()` returns `false` are excluded before scoring.

### Diacritic normalization

Strings are normalized with `NFD` Unicode decomposition before comparison, so accents are ignored:

```ts
fuzzySearch('cafe',   [{ id: '1', label: 'Café',   perform: () => {} }])  // → match
fuzzySearch('muller', [{ id: '2', label: 'Müller', perform: () => {} }])  // → match
```

> Only diacritics are stripped (`é` → `e`, `ü` → `u`). Letters that have no canonical decomposition — such as `ß` — are left as-is, so `ß` does **not** match `ss`.

---

## Keyboard shortcuts

### Modifier + key

```ts
// In a command definition (display hint only — use perform() for the action)
{
  id: 'save',
  label: 'Save File',
  shortcut: ['$mod', 's'],
  perform: () => save(),
}
```

To bind a real global shortcut, use `createKeyboardManager` directly:

```ts
import { createKeyboardManager } from '@macrulez/vue-command-palette'

const km = createKeyboardManager()
km.start()

const unregister = km.registerShortcut(['$mod', 'shift', 'p'], () => {
  openCommandPalette()
})

// Later, to clean up:
unregister()
km.stop()
```

### Bare-key sequences

Two consecutive keys without any modifier, within a 500 ms window:

```ts
km.registerShortcut(['g', 'h'], () => router.push('/home'))
km.registerShortcut(['g', 'p'], () => router.push('/projects'))
km.registerShortcut(['g', 's'], () => router.push('/settings'))
```

### Key reference

| String | Resolved to |
|---|---|
| `'$mod'` | `Meta` on macOS, `Ctrl` on Windows/Linux |
| `'shift'` | Shift |
| `'alt'` | Alt / Option |
| `'ctrl'` | Ctrl (explicit, not cross-platform) |
| `'meta'` | Meta / Cmd (explicit) |
| Any other string | Compared with `event.key.toLowerCase()` |

---

## Nested palettes

Add `subCommands` to any command to open a child palette when it is selected. The parent state is pushed to a breadcrumb history stack.

```ts
{
  id: 'change-theme',
  label: 'Change Theme',
  icon: '🎨',
  perform: () => {},  // not called when subCommands is present
  subCommands: [
    {
      id: 'theme-light',
      label: 'Light',
      icon: '☀️',
      enabled: () => theme.value !== 'light',
      perform: () => { theme.value = 'light' },
    },
    {
      id: 'theme-dark',
      label: 'Dark',
      icon: '🌙',
      enabled: () => theme.value !== 'dark',
      perform: () => { theme.value = 'dark' },
    },
    {
      id: 'theme-system',
      label: 'System',
      icon: '💻',
      enabled: () => theme.value !== 'system',
      perform: () => { theme.value = 'system' },
    },
  ],
}
```

Sub-palettes can be nested to any depth.

### Nested commands are searchable

By default (`searchNested: true`), typing a query also matches commands **inside** `subCommands`, so searching `light` surfaces the actual *Light* command — not just its *Change Theme* parent. Such results are shown with a breadcrumb context (`Change Theme › Light`) via `SearchResult.parents`, and selecting one runs it directly. Commands that open a sub-palette or page show a `›` chevron affordance. Set `searchNested: false` to restrict search to top-level commands only.

**Navigation keys inside a sub-palette:**

| Key | Action |
|---|---|
| `Backspace` (empty input) | Go back to parent palette |
| `Esc` | Go back if history exists, otherwise close |

---

## Confirmation step

Set `confirm` to a non-empty string to require user confirmation before the command runs.

```ts
{
  id: 'delete-project',
  label: 'Delete Project',
  icon: '🗑️',
  keywords: ['remove', 'erase'],
  confirm: 'Delete this project permanently? This action cannot be undone.',
  perform: async () => {
    await api.deleteProject(projectId)
    router.push('/')
  },
}
```

The palette replaces the result list with the confirmation message and two buttons:

- **Yes, proceed** — executes the command and closes
- **Cancel** — dismisses and returns to the result list

`Enter` confirms, `Esc` cancels.

---

## Async search

Each group can provide an `onSearch` callback that returns dynamic commands for a given query. Useful for searching external APIs, databases, or documentation.

```ts
useRegisterGroup({
  id: 'docs-search',
  label: 'Documentation',
  commands: [],  // static commands (can be empty for search-only groups)
  onSearch: async (query: string) => {
    const results = await searchDocs(query)
    return results.slice(0, 5).map(doc => ({
      id: `doc-${doc.slug}`,
      label: doc.title,
      description: doc.excerpt,
      icon: '📄',
      perform: () => window.open(doc.url, '_blank'),
    }))
  },
})
```

- Debounced by **200 ms** to avoid excessive requests
- An unobtrusive spinner appears in the input corner while the request is in flight — already-shown results stay visible (no blanking). The centered loading text only appears when there is nothing to show yet.
- Async results are merged with sync results and re-sorted by score
- Empty query clears async results immediately (no debounce)
- A **plugin-level** `onSearch` option provides one global async source (not tied to a group), merged the same way:
  ```ts
  app.use(VCommandPalettePlugin, { onSearch: (q) => api.search(q) })
  ```

---

## Recent commands

Recent commands are always tracked in memory for the current session and shown above all other commands when the palette opens with an empty query. When `persistRecent: true` (the default), the list is additionally written to `localStorage` so it survives reloads; setting `persistRecent: false` keeps recent working for the session without touching `localStorage`.

```ts
app.use(VCommandPalettePlugin, {
  persistRecent: true,
  maxRecent: 8,           // keep at most 8 commands total
  maxRecentPerGroup: 2,   // at most 2 per group (0 = unlimited)
  localStorageKey: 'myapp:recent',
})
```

Recent commands are resolved at runtime — if a command is unregistered (e.g. its component unmounted), it is silently excluded from the recent list.

---

## Theming

The palette is fully styled via CSS custom properties. Import the default stylesheet, then override variables in your own CSS.

```css
/* Override globally */
:root {
  --vcp-dialog-width: 640px;
  --vcp-item-height: 44px;
  --vcp-item-active-bg: #ede9fe;
  --vcp-match-color: #7c3aed;
}

/* Or scope to a parent element */
.my-app [data-vcp] {
  --vcp-dialog-bg: #fafafa;
}
```

### All CSS custom properties

```css
:root {
  /* Overlay & dialog */
  --vcp-z-index: 9999;
  --vcp-overlay-bg: rgba(0, 0, 0, 0.5);
  --vcp-dialog-bg: #ffffff;
  --vcp-dialog-color: #111111;
  --vcp-dialog-radius: 8px;
  --vcp-dialog-shadow: 0 16px 70px rgba(0, 0, 0, 0.2);
  --vcp-dialog-width: 560px;
  --vcp-dialog-preview-width: 860px;
  --vcp-preview-width: 300px;
  --vcp-dialog-max-height: 60vh;
  --vcp-dialog-padding-top: 15vh;

  /* Borders */
  --vcp-border-color: #eeeeee;

  /* Search input */
  --vcp-input-font-size: 16px;

  /* Result items */
  --vcp-item-height: 40px;
  --vcp-item-active-bg: #f0f0f0;
  --vcp-item-font-size: 14px;
  --vcp-item-radius: 4px;

  /* Group headers */
  --vcp-group-header-color: #999999;
  --vcp-group-header-font-size: 11px;

  /* Keyboard badge */
  --vcp-kbd-bg: #eeeeee;
  --vcp-kbd-border: #dddddd;

  /* Match highlight */
  --vcp-match-color: inherit;

  /* Breadcrumb (nested palettes) */
  --vcp-breadcrumb-color: #888888;

  /* Empty / loading states */
  --vcp-state-color: #999999;

  /* Scrollbar */
  --vcp-scrollbar-thumb: #d0d0d0;
  --vcp-scrollbar-thumb-hover: #b0b0b0;
}
```

### Dark mode

The stylesheet includes automatic dark mode via `@media (prefers-color-scheme: dark)`. To override manually with a theme class:

```css
[data-theme="dark"] {
  --vcp-dialog-bg: #1a1a1a;
  --vcp-dialog-color: #eeeeee;
  --vcp-border-color: #333333;
  --vcp-item-active-bg: #2a2a2a;
  --vcp-kbd-bg: #2a2a2a;
  --vcp-kbd-border: #444444;
  --vcp-group-header-color: #666666;
  --vcp-scrollbar-thumb: #444444;
  --vcp-scrollbar-thumb-hover: #666666;
}
```

### Built-in theme switcher

The palette includes a built-in light / system / dark switcher rendered directly inside the search bar. The initial theme is set via the `colorTheme` plugin option and can be changed at runtime via `useCommandPalette()`:

```ts
app.use(VCommandPalettePlugin, {
  colorTheme: 'dark',   // 'light' | 'dark' | 'system' (default: 'system')
})
```

```ts
// Change theme programmatically from any component
import { useCommandPalette } from '@macrulez/vue-command-palette'

const { colorTheme } = useCommandPalette()
colorTheme.value = 'dark'
```

`'system'` follows `prefers-color-scheme`. Selecting `'light'` or `'dark'` applies `.vcp-theme-light` / `.vcp-theme-dark` on the overlay, which override the media query.

---

## Frecency

With `frecency: true`, the palette tracks how often and how recently each command is executed and adds a bonus to its search score, so your most-used commands float to the top. Stats are kept in memory and (when `persistRecent` is on) persisted to `localStorage` under `<localStorageKey>:frecency`.

```ts
app.use(VCommandPalettePlugin, { frecency: true })
```

The bonus combines frequency (run count) with recency (decays over ~30 days), and never hides a strong exact/prefix match — it only reorders comparable results.

---

## Modes / scopes

Define prefix-activated scopes (like VS Code's `>` commands or `@` symbols). When the query starts with a mode's `prefix`, the prefix is stripped, the placeholder switches, a chip appears, and results come from the mode's `onSearch` (or, if omitted, the regular fuzzy search over the stripped query).

```vue
<CommandPalette
  :modes="[
    { prefix: '>', label: 'Run', placeholder: 'Run a command…', onSearch: searchCommands },
    { prefix: '@', label: 'People', placeholder: 'Find a person…', onSearch: searchPeople },
  ]"
/>
```

```ts
type PaletteMode = {
  prefix: string
  placeholder?: string
  label?: string
  onSearch?: (query: string) => Command[] | Promise<Command[]>
}
```

`Backspace` over the prefix exits the mode. Results are debounced 200 ms.

---

## Preview pane

Set `preview` to show a right-hand panel for the active command — great for details, docs, or thumbnails. It updates as the selection changes (it pairs naturally with the `onHighlight` option for async previews). On narrow screens the pane is hidden automatically.

Two sources fill the pane, in order:

1. The `#preview` slot — `{ command }` scope, full control over the markup.
2. The active command's **`info`** field (plain text or HTML) — rendered after the slot. Handy when you don't need a custom slot.

```vue
<CommandPalette preview>
  <template #preview="{ command }">
    <div v-if="command">
      <h3>{{ command.label }}</h3>
      <p>{{ command.description }}</p>
    </div>
  </template>
</CommandPalette>
```

```ts
useRegisterCommands([
  {
    id: 'analytics',
    label: 'Open Analytics',
    info: '<p>Traffic, conversions and revenue charts.</p>',  // text or HTML
    perform: () => {},
  },
])
```

> **Security:** `info` is rendered with `v-html`. Only pass trusted/sanitised markup.

### Toggling the pane

- A **sidebar icon** appears next to the theme switcher to expand/collapse the pane.
- The `previewHotkey` prop sets a keyboard toggle (default `['$mod', 'i']` → ⌘/Ctrl + I; pass `[]` to disable).
- Opening/closing animates the pane's **width** in sync with the dialog width, so the list stays a constant width and there's no jump; respects `prefers-reduced-motion`.

The dialog only widens to `--vcp-dialog-preview-width` (default `860px`) while the pane is **expanded** — when it's collapsed (or `preview` is off) the dialog returns to the normal `--vcp-dialog-width` (`560px`). The pane is `--vcp-preview-width` wide (default `300px`); keep `dialog-preview-width − dialog-width = preview-width` for a perfectly steady list during the animation.

---

## Mobile / touch

The palette is responsive out of the box: on viewports ≤ 640px the dialog goes full-width with larger (48px) touch targets, the preview pane is hidden, and hover styles are disabled on touch devices. Inside a nested palette/page, **swipe right** to go back.

---

## Pinned commands

Users can pin any command to a **Pinned** section shown above *Recent* in the empty-query view. Toggle a pin with `$mod+P` on the active item, by **clicking the pin icon** on the row (it appears as a ghost on hover / keyboard-active rows, and stays lit on pinned commands — clicking it never runs the command), or via the composable API. Pins persist to `localStorage` (`<localStorageKey>:pinned`) when `persistRecent` is on.

```ts
const { pin, unpin, togglePin, isPinned, getPinnedCommands, pinnedIds } = useCommandPalette()
```

---

## Secondary actions

A command can expose secondary `actions` (open, copy, delete, …). Press `Tab` on the active item to open the actions menu; arrows navigate, `Enter` runs, and `Esc` / `Tab` / `Backspace` (or the **‹ Back** button in the header) returns to the list. Customise the menu with the `#actions` slot (`{ command, run, activeIndex, close }`).

```ts
useRegisterCommands([
  {
    id: 'export',
    label: 'Export data',
    perform: () => download(),
    actions: [
      { id: 'copy', label: 'Copy as JSON', perform: () => copyJson() },
      { id: 'mail', label: 'Email export', shortcut: ['$mod', 'm'], perform: () => email() },
    ],
  },
])
```

Items with actions show a `⋯` affordance.

---

## Multi-select

With `selectable`, the palette becomes a multi-picker: `Enter` (or click) toggles the active item, `$mod+Enter` submits. Selected rows show a checkbox.

```vue
<CommandPalette selectable @submit-selection="onPicked" />
```

```ts
function onPicked(commands: Command[]) {
  // do something with the chosen commands
}
```

---

## Query history

Recently submitted queries are remembered for the session. With an empty or any input, press `Alt+ArrowUp` / `Alt+ArrowDown` to cycle through previous queries (most recent first). Exposed read-only as `useCommandPalette().queryHistory`.

---

## Custom search strategy

Replace the built-in fuzzy engine with any scorer — for example [Fuse.js](https://fusejs.io). The function receives the query and all available commands and returns ranked `SearchResult[]` (highest score first). The store still assigns `groupId` to each result afterwards.

```ts
import Fuse from 'fuse.js'
import type { SearchFn } from '@macrulez/vue-command-palette'

const fuseSearch: SearchFn = (query, commands) => {
  const fuse = new Fuse(commands, { keys: ['label', 'description', 'keywords'], includeScore: true })
  return fuse.search(query).map(r => ({
    command: r.item,
    score: 1 - (r.score ?? 0),
    matches: [],
  }))
}

app.use(VCommandPalettePlugin, { search: fuseSearch })
```

---

## Binding shortcuts

By default `shortcut` is a display-only hint. Set `bindShortcuts: true` and each command's `shortcut` becomes a real global hotkey that runs the command through the same flow as clicking it (confirm dialogs and pages included). Shortcuts are registered and cleaned up automatically as commands are added and removed.

```ts
app.use(VCommandPalettePlugin, { bindShortcuts: true })

useRegisterCommands([
  { id: 'save', label: 'Save', shortcut: ['$mod', 's'], perform: () => save() },
  { id: 'find', label: 'Find', shortcut: ['$mod', 'f'], perform: () => openFind() },
])
```

---

## Command pages

A command can open a **page** instead of (or in addition to) running. A page is like a nested palette, but with its own placeholder and an async `onSearch` handler driven by the input — ideal for remote pickers and filters.

```ts
useRegisterCommands([
  {
    id: 'assign-user',
    label: 'Assign to user…',
    icon: '👤',
    perform: () => {},  // not called — the page opens instead
    page: {
      placeholder: 'Search users…',
      // items: [...]   // optional static items shown on empty query
      onSearch: async (query) => {
        const users = await api.searchUsers(query)
        return users.map(u => ({
          id: `user-${u.id}`,
          label: u.name,
          description: u.email,
          perform: () => assign(u.id),
        }))
      },
    },
  },
])
```

`Backspace` (empty input) / `Esc` navigate back, exactly like sub-palettes. Results are debounced 200 ms; if `onSearch` is omitted, the page filters its static `items` by the query.

---

## Multiple instances

Run several independent palettes on one app — e.g. a global command bar plus a sidebar search — each with its own hotkey, commands and state. Use `createCommandPalette()` for every instance beyond the default (it returns a fresh plugin object so Vue's `app.use` de-duplication doesn't skip it).

```ts
import { VCommandPalettePlugin, createCommandPalette } from '@macrulez/vue-command-palette'

app.use(VCommandPalettePlugin)                                   // default instance
app.use(createCommandPalette({ name: 'sidebar', hotkey: ['$mod', 'j'] }))
```

```vue
<template>
  <!-- default -->
  <CommandPalette />
  <!-- sidebar -->
  <CommandPalette name="sidebar" placeholder="Search the sidebar…" />
</template>
```

Target a specific instance from composables via the `name` argument:

```ts
const sidebar = useCommandPalette('sidebar')
useRegisterCommands([/* … */], 'sidebar')
useRegisterGroup({ /* … */ }, 'sidebar')
```

---

## Localization

Built-in UI strings (the *Recent* header, confirm dialog buttons, theme-switcher titles, ARIA labels) can be overridden via the `labels` prop. Only the keys you pass are overridden; the rest fall back to the English defaults.

```vue
<CommandPalette
  placeholder="Поиск команд…"
  empty-text="Ничего не найдено."
  loading-text="Загрузка…"
  :labels="{
    recent: 'Недавние',
    confirmYes: 'Да, продолжить',
    confirmCancel: 'Отмена',
    themeLight: 'Светлая тема',
    themeDark: 'Тёмная тема',
    themeSystem: 'Системная тема',
    dialogLabel: 'Палитра команд',
    loading: 'Загрузка',
  }"
/>
```

### `PaletteLabels`

| Key | Default | Where it appears |
|---|---|---|
| `recent` | `'Recent'` | Header above recent commands (empty query) |
| `pinned` | `'Pinned'` | Header above pinned commands (empty query) |
| `pin` / `unpin` | `'Pin'` / `'Unpin'` | `title` of the per-row pin icon |
| `actions` | `'Actions'` | Header of the secondary-actions menu |
| `back` | `'Back'` | "Back" affordance (actions menu) |
| `togglePreview` | `'Toggle preview panel'` | `title`/`aria-label` of the preview toggle button |
| `confirmYes` | `'Yes, proceed'` | Confirm dialog — proceed button |
| `confirmCancel` | `'Cancel'` | Confirm dialog — cancel button |
| `themeLight` | `'Light theme'` | Theme switcher button title |
| `themeDark` | `'Dark theme'` | Theme switcher button title |
| `themeSystem` | `'System theme'` | Theme switcher button title |
| `dialogLabel` | `'Command palette'` | `aria-label` of the dialog |
| `loading` | `'Loading'` | `aria-label` of the per-item spinner |
| `resultsCount` | `(n) => '… results available'` | `aria-live` announcement of the result count (a function) |

> Note: `placeholder`, `emptyText` and `loadingText` remain separate props on `CommandPalette`.

---

## Nuxt

Add to `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@macrulez/vue-command-palette/nuxt'],
})
```

Options are read from `runtimeConfig.public.vCommandPalette`. Configure in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@macrulez/vue-command-palette/nuxt'],
  runtimeConfig: {
    public: {
      vCommandPalette: {
        hotkey: ['$mod', 'k'],
        persistRecent: true,
        maxRecent: 5,
      },
    },
  },
})
```

The Nuxt module installs the plugin automatically. `useCommandPalette`, `useRegisterGroup`, and `useRegisterCommands` are available in all components without explicit imports (if using `@nuxt/eslint` with auto-imports enabled).

---

## Testing utilities

```ts
import { createPaletteContext, PaletteProvider } from '@macrulez/vue-command-palette/testing'
```

### `createPaletteContext`

Creates a fully isolated palette context — no real DOM, no plugin, no `localStorage` side-effects:

```ts
import { createPaletteContext } from '@macrulez/vue-command-palette/testing'
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import MyComponent from './MyComponent.vue'

describe('MyComponent', () => {
  it('executes the command', async () => {
    const performFn = vi.fn()

    const { provide, isOpen, query, store } = createPaletteContext({
      commands: [
        { id: 'test-cmd', label: 'Test Command', perform: performFn },
      ],
    })

    const wrapper = mount(MyComponent, {
      global: { provide },
    })

    // Interact
    query.value = 'test'
    await wrapper.find('[data-testid="item"]').trigger('click')

    expect(performFn).toHaveBeenCalledOnce()
  })
})
```

### `PaletteProvider`

A wrapper component that provides context to its slot children — useful for component tree tests:

```ts
import { PaletteProvider } from '@macrulez/vue-command-palette/testing'
import { mount } from '@vue/test-utils'

const wrapper = mount(PaletteProvider, {
  props: {
    commands: [{ id: 'cmd', label: 'My Command', perform: vi.fn() }],
    groups: [],
  },
  slots: {
    default: MyConsumerComponent,
  },
})
```

### `createPaletteContext` options

| Option | Type | Default | Description |
|---|---|---|---|
| `commands` | `Command[]` | `[]` | Commands to pre-register (no group) |
| `groups` | `CommandGroup[]` | `[]` | Groups to pre-register |
| `persistRecent` | `boolean` | `false` | Enable `localStorage` persistence |
| `maxRecent` | `number` | `5` | Recent command limit |
| `maxRecentPerGroup` | `number` | `0` | Per-group recent limit |
| `localStorageKey` | `string` | `'vcp:recent:test'` | Key used if `persistRecent` is `true` |
| `onOpen` | `() => void` | — | Mock callback for open events |
| `onClose` | `() => void` | — | Mock callback for close events |
| `onError` | `(err, cmd) => void` | — | Mock error handler |

### Return value

```ts
const {
  ctx,          // full PaletteContext — pass to inject-based code
  store,        // CommandStore — register/search commands directly
  isOpen,       // Ref<boolean>
  query,        // Ref<string>
  activeIndex,  // Ref<number>
  provide,      // Record for Vue Test Utils `global: { provide }`
} = createPaletteContext(options)
```

---

## Typed command data

Attach an arbitrary, type-safe payload to commands via the generic `Command<T>` and its `data` field. `useRegisterCommands<T>` / `useRegisterGroup<T>`, `fuzzySearch<T>`, `SearchResult<T>` and `SearchFn<T>` all carry the type through, so you get full inference (and errors on mismatches). It defaults to `unknown`, so existing untyped usage is unaffected.

```ts
interface UserData { id: number; email: string }

useRegisterCommands<UserData>([
  {
    id: 'user-ada',
    label: 'Ada Lovelace',
    data: { id: 1, email: 'ada@example.com' },  // checked against UserData
    perform: () => {},
  },
])

// Standalone search keeps the type:
const results = fuzzySearch<UserData>('ada', commands)
results[0].command.data?.email  // string | undefined
```

```ts
// @ts-expect-error — data must match UserData
const bad: Command<UserData> = { id: 'x', label: 'X', data: { wrong: true }, perform: () => {} }
```

> Inside the `#item` / `#preview` slots the `command` is typed as `Command` (`data: unknown`) since the palette stores commands of mixed types — narrow with a cast or a type guard when you need the payload there.

---

## TypeScript types

All public types are exported from the package root:

```ts
import type {
  Command,
  CommandGroupType,  // group definition — NOT the CommandGroup component
  CommandAction,     // secondary action on a command
  CommandPage,       // page opened by a command (placeholder + async onSearch)
  SearchResult,      // { command, score, matches, groupId?, parents?, matchedField? }
  SearchFn,          // custom search strategy signature
  PaletteMode,       // prefix-activated scope
  CommandUsage,      // frecency stat { count, lastUsed }
  PaletteOptions,
  PaletteLabels,     // customisable UI strings (i18n)
  PaletteContext,
  PaletteState,
  CommandStore,
  KeyboardManager,
} from '@macrulez/vue-command-palette'
```

> **Note**: The named export `CommandGroup` is the **Vue component**. The group-definition interface is exported as `CommandGroupType` to avoid the collision.

### `SearchResult`

```ts
interface SearchResult {
  command: Command
  score: number
  matches: Array<[start: number, end: number]>
  groupId?: string
  parents?: Command[]  // ancestor chain when the result is a nested sub-command
  matchedField?: 'label' | 'description' | 'keyword' | 'alias'  // which field won the score
  matchedText?: string                                          // matching keyword/alias text
}
```

### `PaletteContext`

The full injectable context, accessible in custom composables via `inject(PALETTE_INJECT_KEY)`:

```ts
interface PaletteContext {
  store: CommandStore
  keyboard: KeyboardManager
  isOpen: Ref<boolean>
  query: Ref<string>
  activeIndex: Ref<number>
  history: Ref<HistoryEntry[]>
  recentIds: Ref<string[]>
  loadingCommandId: Ref<string | null>
  results: ComputedRef<SearchResult[]>
  persistRecent: boolean
  maxRecent: number
  maxRecentPerGroup: number
  localStorageKey: string
  onOpen?: () => void
  onClose?: () => void
  onError?: (err: unknown, command: Command) => void
}
```

---

## Accessibility

| Feature | Implementation |
|---|---|
| `role="dialog"` + `aria-modal="true"` | Applied to the palette dialog element |
| `role="combobox"` | Applied to the search `<input>` |
| `aria-expanded="true"` | Set on the input while the palette is open |
| `aria-controls` | Input points to the `role="listbox"` result list |
| `aria-activedescendant` | Updated as the keyboard-active item changes |
| `role="listbox"` | Applied to the result list container |
| `role="option"` | Applied to each `CommandItem` |
| `aria-selected` | Set to `true` on the currently active item |
| `aria-disabled` | Set when `disabled: true` or `enabled()` returns `false` |
| `aria-live="polite"` | Breadcrumb — screen readers announce sub-palette navigation; a visually-hidden region also announces the result count (`labels.resultsCount`) |
| Focus trap | `Tab` is intercepted to keep focus inside the dialog |
| Scroll lock | `document.body.style.overflow` is set to `hidden` while open |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` disables the fade transition |

---

## SSR compatibility

All browser-only APIs are guarded before use:

```ts
// KeyboardManager — skips addEventListener on the server
if (typeof document === 'undefined') return

// Recent commands — skips localStorage on the server
if (typeof localStorage === 'undefined') return

// CommandItem — platform detection for ⌘ vs Ctrl label
typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
```

`VirtualList` (used for result sets > 50 items) renders an empty placeholder on the server and hydrates on the client. All slot content and command registration are fully SSR-safe.

---

## Bundle size

| Entry point | Peer deps | Notes |
|---|---|---|
| `@macrulez/vue-command-palette` | `vue ^3.3` | Components, composables, fuzzy engine, keyboard manager |
| `@macrulez/vue-command-palette/style.css` | — | Default styles; ~3 KB |
| `@macrulez/vue-command-palette/testing` | `vue ^3.3` | `createPaletteContext` + `PaletteProvider`; dev/test only |
| `@macrulez/vue-command-palette/nuxt` | `nuxt ^3`, `vue ^3.3` | Nuxt auto-plugin |

Ships as tree-shakeable ESM (`dist/@macrulez/vue-command-palette.js`) + CJS (`dist/@macrulez/vue-command-palette.cjs`). Core bundle without styles is ~11 KB gzip; the stylesheet is ~2 KB gzip.

---

## License

MIT

---

## Author

Danil Lisin Vladimirovich aka Macrulez

GitHub: [macrulezru](https://github.com/macrulezru) · Website: [macrulez.ru/en](https://macrulez.ru/en)

Bugs and questions — [issues](https://github.com/macrulezru/vue-command-palette/issues)

---

## 💖 Support the project

Open source takes time and effort. If my work saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️
