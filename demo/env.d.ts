/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}

// CSS side-effect imports
declare module '*.css' {}
declare module 'vue-command-palette/style.css' {}
