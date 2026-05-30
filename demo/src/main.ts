import { createApp } from 'vue'
import { VCommandPalettePlugin, createCommandPalette } from '@macrulez/vue-command-palette'
import '@macrulez/vue-command-palette/style.css'
import App from './App.vue'
import './style.css'

const app = createApp(App)

// Default instance — the main command palette (Cmd/Ctrl + K).
app.use(VCommandPalettePlugin, {
  hotkey: ['$mod', 'k'],
  persistRecent: true,
  maxRecent: 6,
  frecency: true, // boost frequently/recently used commands
  showDisabled: true, // show disabled commands greyed out instead of hiding them
  bindShortcuts: true, // command `shortcut`s become real global hotkeys (try Alt+N / Alt+C)
  onOpen: () => console.log('[demo] palette opened'),
  onClose: () => console.log('[demo] palette closed'),
  onError: (err: unknown, cmd: { label: string }) => console.error(`[demo] command "${cmd.label}" failed:`, err),
  onHighlight: (cmd: { label: string } | null) => console.log('[demo] highlight:', cmd?.label ?? '—'),
})

// A second, independent named instance — a quick-actions palette (Alt + J).
app.use(createCommandPalette({
  name: 'quick',
  hotkey: ['alt', 'j'],
  persistRecent: false,
}))

app.mount('#app')
