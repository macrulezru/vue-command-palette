import type { CommandGroupType } from '@macrulez/vue-command-palette'
import type { Ref } from 'vue'

export function buildCommands(
  page: Ref<string>,
  theme: Ref<'light' | 'dark' | 'system'>,
  notifications: Ref<boolean>,
  toast: (msg: string, type?: 'info' | 'success' | 'error') => void,
): CommandGroupType[] {
  return [
    {
      id: 'navigation',
      label: 'Navigation',
      priority: 100,
      commands: [
        {
          id: 'nav-dashboard',
          label: 'Go to Dashboard',
          description: 'Overview of your projects and activity',
          icon: '🏠',
          keywords: ['home', 'main', 'start'],
          perform: () => { page.value = 'dashboard'; toast('Navigated to Dashboard') },
        },
        {
          id: 'nav-projects',
          label: 'Go to Projects',
          description: 'Manage your projects',
          icon: '📁',
          keywords: ['repos', 'work'],
          perform: () => { page.value = 'projects'; toast('Navigated to Projects') },
        },
        {
          id: 'nav-analytics',
          label: 'Go to Analytics',
          description: 'Charts, metrics and reports',
          icon: '📊',
          keywords: ['stats', 'reports', 'metrics', 'charts'],
          perform: () => { page.value = 'analytics'; toast('Navigated to Analytics') },
        },
        {
          id: 'nav-team',
          label: 'Go to Team',
          description: 'Manage members and permissions',
          icon: '👥',
          keywords: ['members', 'people', 'users'],
          perform: () => { page.value = 'team'; toast('Navigated to Team') },
        },
        {
          id: 'nav-settings',
          label: 'Go to Settings',
          description: 'Account and app preferences',
          icon: '⚙️',
          aliases: ['Preferences', 'Options', 'Configuration'],
          shortcut: ['$mod', ','],
          perform: () => { page.value = 'settings'; toast('Navigated to Settings') },
        },
      ],
    },
    {
      id: 'appearance',
      label: 'Appearance',
      priority: 80,
      commands: [
        {
          id: 'theme',
          label: 'Change Theme',
          description: 'Switch between light, dark and system',
          icon: '🎨',
          keywords: ['color', 'dark mode', 'light mode'],
          perform: () => {},
          subCommands: [
            {
              id: 'theme-light',
              label: 'Light',
              icon: '☀️',
              description: 'Use light theme',
              enabled: () => theme.value !== 'light',
              perform: () => { theme.value = 'light'; toast('Theme set to Light', 'success') },
            },
            {
              id: 'theme-dark',
              label: 'Dark',
              icon: '🌙',
              description: 'Use dark theme',
              enabled: () => theme.value !== 'dark',
              perform: () => { theme.value = 'dark'; toast('Theme set to Dark', 'success') },
            },
            {
              id: 'theme-system',
              label: 'System',
              icon: '💻',
              description: 'Follow OS preference',
              enabled: () => theme.value !== 'system',
              perform: () => { theme.value = 'system'; toast('Theme set to System', 'success') },
            },
          ],
        },
        {
          id: 'toggle-notifications',
          label: 'Toggle Notifications',
          description: 'Toggle push notifications on/off',
          icon: '🔔',
          keywords: ['alerts', 'mute'],
          perform: () => {
            notifications.value = !notifications.value
            toast(notifications.value ? 'Notifications enabled' : 'Notifications disabled', 'info')
          },
        },
      ],
    },
    {
      id: 'actions',
      label: 'Actions',
      priority: 60,
      commands: [
        {
          id: 'copy-link',
          label: 'Copy Page Link',
          description: 'Copy current URL to clipboard',
          icon: '🔗',
          shortcut: ['$mod', 'shift', 'c'],
          perform: async () => {
            await navigator.clipboard.writeText(window.location.href)
            toast('Link copied to clipboard!', 'success')
          },
        },
        {
          id: 'new-project',
          label: 'New Project',
          description: 'Create a new project from scratch',
          icon: '✨',
          shortcut: ['$mod', 'n'],
          perform: async () => {
            await new Promise(r => setTimeout(r, 1200))
            toast('Project created!', 'success')
          },
        },
        {
          id: 'export-data',
          label: 'Export Data',
          description: 'Download all your data as JSON',
          icon: '📤',
          keywords: ['download', 'backup'],
          confirm: 'Export all data? This will download a JSON file with your account data.',
          perform: async () => {
            await new Promise(r => setTimeout(r, 800))
            toast('Data exported!', 'success')
          },
        },
        {
          id: 'delete-account',
          label: 'Delete Account',
          description: 'Permanently delete your account and all data',
          icon: '🗑️',
          keywords: ['remove', 'erase'],
          confirm: 'Are you sure you want to delete your account? This action cannot be undone.',
          perform: () => { toast('Account deleted (demo mode — not really!)', 'error') },
        },
        {
          id: 'failing-command',
          label: 'Simulate Error',
          description: 'Triggers onError handler (for demo)',
          icon: '💥',
          perform: () => { throw new Error('Demo error from perform()') },
        },
        {
          id: 'disabled-cmd',
          label: 'Disabled Command',
          description: 'This command is always disabled',
          icon: '🚫',
          disabled: true,
          perform: () => {},
        },
      ],
    },
    {
      id: 'search',
      label: 'Search',
      priority: 40,
      commands: [],
      onSearch: async (query: string) => {
        await new Promise(r => setTimeout(r, 300))
        const items = [
          'React documentation',
          'Vue 3 composables guide',
          'TypeScript handbook',
          'Vite configuration',
          'Node.js best practices',
          'CSS Grid layout',
          'Tailwind CSS docs',
          'Figma design tokens',
        ]
        return items
          .filter(item => item.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 4)
          .map(item => ({
            id: `search-${item}`,
            label: item,
            description: 'Open in new tab',
            icon: '🔍',
            perform: () => toast(`Opening: ${item}`, 'info'),
          }))
      },
    },
  ]
}
