import { createApp } from 'vue'
import { VCommandPalettePlugin } from 'vue-command-palette'
import 'vue-command-palette/style.css'
import App from './App.vue'
import './style.css'

const app = createApp(App)

app.use(VCommandPalettePlugin, {
  hotkey: ['$mod', 'k'],
  persistRecent: true,
  maxRecent: 6,
  onOpen: () => console.log('[demo] palette opened'),
  onClose: () => console.log('[demo] palette closed'),
  onError: (err: unknown, cmd: { label: string }) => console.error(`[demo] command "${cmd.label}" failed:`, err),
})

app.mount('#app')
