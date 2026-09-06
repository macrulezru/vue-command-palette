# **Command Palette**

![Command Palette](https://github.com/macrulezru/assets/blob/master/packages-images/vue-command-palette.png?raw=true)

Command+K palette for Vue 3. Fuzzy search with match highlighting, grouped commands, nested sub-palettes, global keyboard shortcuts, async search, confirmation dialogs, recent command history, and full headless customisation via slots — all with a single peer dependency (Vue 3).

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

## When you'd reach for this

Cmd+K has become an expected pattern in serious tools — vue-command-palette gives you a ready, fully customisable implementation instead of building search, keyboard navigation, and match highlighting from scratch.

- **Actions are scattered across the interface** — Settings live in one corner, export in another, theme switching in a third — a command palette pulls all of it into one place, reachable from the keyboard without hunting through menus.
- **A command needs clarification before it runs** — "Assign to user" can't just execute — it needs to find a person first; a nested page with its own async search handles that without a separate modal.
- **A destructive command sits next to ordinary ones** — "Delete project" shouldn't be one click away like "Open settings" — a built-in confirm step guards against a stray click.
- **The same commands come up every day** — Instead of retyping them each time, recent and pinned commands rise to the top on an empty query, and the ones you use most often climb even higher over time.

---

## Installation

| Environment | Minimum version                                   |
| ----------- | --------------------------------------------------- |
| Vue         | `3.3.0+`                                             |
| Node.js     | `18+`                                                |
| `@nuxt/kit` | `3.0.0+` (optional — only for the `/nuxt` module)    |

```bash
npm install @macrulez/vue-command-palette
```

Peer dependency:

```bash
npm install vue@>=3.3
```

### Quick start

```ts
// main.ts
import { createApp } from 'vue'
import { VCommandPalettePlugin } from '@macrulez/vue-command-palette'
import '@macrulez/vue-command-palette/style.css'
import App from './App.vue'

const app = createApp(App)

app.use(VCommandPalettePlugin, {
  hotkey: ['$mod', 'k'], // Cmd+K on macOS, Ctrl+K on Windows/Linux
  colorTheme: 'system', // 'light' | 'dark' | 'system'
  persistRecent: true,
  maxRecent: 5,
})

app.mount('#app')
```

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
  ],
})
</script>

<template>
  <RouterView />
  <CommandPalette placeholder="Search commands…" :max-results="12" />
</template>
```

Press **Cmd+K** / **Ctrl+K** to open.

### More examples

#### Two-key navigation, GitHub-style

Two bare keys in a row, no modifier — `g`, then `h` — within a 500ms window. `registerShortcut` parses sequences like this itself.

```ts
import { createKeyboardManager } from '@macrulez/vue-command-palette'

const km = createKeyboardManager()
km.start()

km.registerShortcut(['g', 'h'], () => router.push('/home'))
km.registerShortcut(['g', 'p'], () => router.push('/projects'))
km.registerShortcut(['g', 's'], () => router.push('/settings'))

// Two bare keys, no modifier, pressed within a 500ms window — the same
// "g then h" navigation pattern as GitHub's own keyboard shortcuts.
```

#### Nested palettes are searchable directly

`subCommands` opens a child palette on selection, and a query like "light" finds the command inside it right away — with a "Change Theme › Light" breadcrumb, no need to open the submenu first.

```ts
const changeTheme = {
  id: 'change-theme',
  label: 'Change Theme',
  icon: '🎨',
  subCommands: [
    { id: 'theme-light', label: 'Light', icon: '☀️', perform: () => (theme.value = 'light') },
    { id: 'theme-dark', label: 'Dark', icon: '🌙', perform: () => (theme.value = 'dark') },
    { id: 'theme-system', label: 'System', icon: '💻', perform: () => (theme.value = 'system') },
  ],
}

// With searchNested (on by default), typing "light" finds the command
// inside the sub-palette directly — shown with a breadcrumb, "Change
// Theme › Light" — no need to open "Change Theme" first.
```

#### Async search against any external source

A group's `onSearch` can hit any API — docs, a database, search — debounced 200ms, merged with the synchronous results, and re-sorted by relevance.

```ts
import { useRegisterGroup } from '@macrulez/vue-command-palette'

useRegisterGroup({
  id: 'docs-search',
  label: 'Documentation',
  commands: [],
  onSearch: async (query) => {
    const results = await searchDocs(query)
    return results.slice(0, 5).map((doc) => ({
      id: `doc-${doc.slug}`,
      label: doc.title,
      description: doc.excerpt,
      icon: '📄',
      perform: () => window.open(doc.url, '_blank'),
    }))
  },
})

// Debounced 200ms, merged with the synchronous results and re-sorted by
// score — already-shown results stay visible while the request is in flight.
```

---

## Documentation & links

- 📖 **Full documentation:** [npm.vuecraft.ru/en/packages/vue-command-palette](https://npm.vuecraft.ru/en/packages/vue-command-palette/guide/overview.html)
- 🌐 **VueCraft:** [vuecraft.ru/en](https://vuecraft.ru/en)
- 👤 **Author:** [macrulez.ru/en](https://macrulez.ru/en)
- 💻 **GitHub:** [macrulezru/vue-command-palette](https://github.com/macrulezru/vue-command-palette)
- 📦 **NPM:** [@macrulez/vue-command-palette](https://www.npmjs.com/package/@macrulez/vue-command-palette)
- 🐛 **Issues:** [github.com/macrulezru/vue-command-palette/issues](https://github.com/macrulezru/vue-command-palette/issues)

---

## License

MIT

---

## 💖 Support the project

Open source takes time and effort. If this library saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️
