import type { CommandGroupType } from '@macrulez/vue-command-palette'
import type { Ref } from 'vue'

export function buildCommands(
  page: Ref<string>,
  theme: Ref<'light' | 'dark' | 'system'>,
  notifications: Ref<boolean>,
  toast: (msg: string, type?: 'info' | 'success' | 'error') => void,
): CommandGroupType[] {
  const groups: CommandGroupType[] = [
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
          data: { open: 12, closed: 30 },
          perform: () => { page.value = 'projects'; toast('Navigated to Projects') },
        },
        {
          id: 'nav-analytics',
          label: 'Go to Analytics',
          description: 'Charts, metrics and reports',
          icon: '📊',
          keywords: ['stats', 'reports', 'metrics', 'charts'],
          info: '<p>The <strong>Analytics</strong> page shows traffic, conversions and revenue charts.</p><p>- Real-time visitors</br>- Funnel breakdown</br>- Exportable reports</p>',
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
          shortcut: ['alt', 'c'],
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
          badge: 'New',
          shortcut: ['alt', 'n'],
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
          info: '<p>Exports <strong>all</strong> account data as a single JSON file.</p><p style="color:#f59e0b">⚠ This may take a while for large accounts.</p>',
          perform: async () => {
            await new Promise(r => setTimeout(r, 800))
            toast('Data exported!', 'success')
          },
          actions: [
            { id: 'export-copy', label: 'Copy as JSON', icon: '📋', perform: () => toast('Copied JSON to clipboard', 'success') },
            { id: 'export-email', label: 'Email export', icon: '✉️', perform: () => toast('Export emailed', 'info') },
          ],
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
          id: 'assign-user',
          label: 'Assign to user…',
          description: 'Opens a page with its own async search',
          icon: '👤',
          keywords: ['member', 'people', 'page'],
          perform: () => {},
          page: {
            placeholder: 'Search users by name…',
            onSearch: async (query: string) => {
              await new Promise(r => setTimeout(r, 300))
              const users = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Linus Torvalds', 'Margaret Hamilton', 'Dennis Ritchie']
              return users
                .filter(u => u.toLowerCase().includes(query.toLowerCase()))
                .map(u => ({
                  id: `assign-${u}`,
                  label: u,
                  description: 'Assign the current item to this user',
                  icon: '🧑‍💻',
                  perform: () => toast(`Assigned to ${u}`, 'success'),
                }))
            },
          },
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
          disabledReason: 'This command is disabled in the demo',
          badge: { text: 'Off', color: '#9ca3af' },
          perform: () => {},
        },
      ],
    },
    {
      id: 'file',
      label: 'File',
      priority: 90,
      commands: [
        // No description — shows a compact single-line row
        {
          id: 'file-new',
          label: 'New File',
          icon: '📄',
          shortcut: ['alt', 'shift', 'n'],
          perform: () => toast('New file created'),
        },
        {
          id: 'file-open',
          label: 'Open File…',
          description: 'Open a file from disk',
          icon: '📂',
          keywords: ['load', 'browse'],
          perform: () => toast('Open file dialog'),
        },
        // No description
        {
          id: 'file-save',
          label: 'Save',
          icon: '💾',
          shortcut: ['alt', 's'],
          perform: () => toast('File saved', 'success'),
        },
        // No description
        {
          id: 'file-save-as',
          label: 'Save As…',
          icon: '💾',
          perform: () => toast('Save as dialog'),
        },
        {
          id: 'file-recent',
          label: 'Open Recent',
          description: 'Reopen a recently closed file',
          icon: '🕘',
          keywords: ['history'],
          perform: () => {},
          subCommands: [
            { id: 'recent-app', label: 'App.vue', description: 'demo/src/components', icon: '📄', perform: () => toast('Opened App.vue') },
            { id: 'recent-main', label: 'main.ts', icon: '📄', perform: () => toast('Opened main.ts') },
            { id: 'recent-commands', label: 'commands.ts', description: 'demo/src', icon: '📄', perform: () => toast('Opened commands.ts') },
            { id: 'recent-style', label: 'style.css', icon: '🎨', perform: () => toast('Opened style.css') },
            { id: 'recent-readme', label: 'README.md', description: 'edited 2h ago', icon: '📘', perform: () => toast('Opened README.md') },
          ],
        },
        {
          id: 'file-export',
          label: 'Export As…',
          description: 'Export the current document',
          icon: '📤',
          perform: () => {},
          subCommands: [
            { id: 'exp-pdf', label: 'PDF', description: 'Portable Document Format', icon: '📕', perform: () => toast('Exported as PDF', 'success') },
            { id: 'exp-png', label: 'PNG image', icon: '🖼️', perform: () => toast('Exported as PNG', 'success') },
            { id: 'exp-svg', label: 'SVG vector', icon: '🔷', perform: () => toast('Exported as SVG', 'success') },
            { id: 'exp-md', label: 'Markdown', icon: '📝', badge: 'Beta', perform: () => toast('Exported as Markdown', 'success') },
          ],
        },
      ],
    },
    {
      id: 'developer',
      label: 'Developer',
      priority: 50,
      commands: [
        // No description
        { id: 'dev-console', label: 'Toggle Console', icon: '🖥️', keywords: ['devtools', 'log'], perform: () => toast('Console toggled') },
        {
          id: 'dev-reload',
          label: 'Reload Window',
          description: 'Reload the app without cache',
          icon: '🔄',
          keywords: ['refresh', 'restart'],
          perform: () => toast('Window reloaded'),
        },
        {
          id: 'git',
          label: 'Git',
          description: 'Source control actions',
          icon: '🔱',
          keywords: ['version', 'vcs', 'source control'],
          info: '<p>Branch: <code>7-new-version</code></p><p>3 changes · 0 staged</p>',
          perform: () => {},
          subCommands: [
            { id: 'git-commit', label: 'Commit…', description: 'Commit staged changes', icon: '✅', shortcut: ['$mod', 'enter'], perform: () => toast('Committed') },
            { id: 'git-push', label: 'Push', icon: '⬆️', perform: () => toast('Pushed', 'success') },
            { id: 'git-pull', label: 'Pull', icon: '⬇️', perform: () => toast('Pulled', 'success') },
            { id: 'git-stash', label: 'Stash Changes', icon: '📦', perform: () => toast('Changes stashed') },
            {
              // Deep nesting: Git → Branches → branch list
              id: 'git-branch',
              label: 'Branches',
              description: 'Switch or create a branch',
              icon: '🌿',
              perform: () => {},
              subCommands: [
                { id: 'branch-main', label: 'main', icon: '🌿', perform: () => toast('Switched to main') },
                { id: 'branch-develop', label: 'develop', icon: '🌿', perform: () => toast('Switched to develop') },
                { id: 'branch-feature', label: 'feature/command-palette', description: 'last commit 2h ago', icon: '🌿', perform: () => toast('Switched to feature/command-palette') },
                { id: 'branch-new', label: 'Create new branch…', icon: '➕', perform: () => toast('New branch') },
              ],
            },
          ],
        },
        {
          id: 'dev-build',
          label: 'Build Status',
          description: 'Latest CI pipeline result',
          icon: '🟢',
          badge: { text: 'passing', color: '#22c55e' },
          perform: () => toast('Build: passing'),
        },
        // Dynamically disabled (enabled() → false) — visible greyed thanks to showDisabled
        {
          id: 'dev-deploy',
          label: 'Deploy to Production',
          description: 'Ship the current build',
          icon: '🚀',
          keywords: ['release', 'ship'],
          enabled: () => false,
          disabledReason: 'You need the admin role to deploy',
          perform: () => toast('Deploying…'),
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

  // Tag each command with its group label so `group-recent` can cluster the
  // recent list under sub-headers.
  for (const group of groups) {
    for (const cmd of group.commands) cmd.group ??= group.label
  }

  return groups
}
