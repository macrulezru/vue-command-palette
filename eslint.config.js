import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  // Global ignores
  {
    ignores: ['dist/**', 'node_modules/**', 'demo/**', 'coverage/**'],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // Vue rules
  ...pluginVue.configs['flat/recommended'],

  // Parser for Vue SFCs + browser globals for all source files
  {
    files: ['**/*.vue', '**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
  },

  // Test files
  {
    files: ['**/*.test.ts', 'src/__tests__/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'vue/one-component-per-file': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Nuxt module/plugin use @nuxt/kit generics and the #imports virtual import,
  // only fully resolvable inside a real Nuxt project
  {
    files: ['src/nuxt/module.ts', 'src/nuxt/runtime/plugin.ts'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },

  // Project-specific overrides
  {
    files: ['src/**/*.{ts,vue}'],
    rules: {
      // Allow unused vars prefixed with _
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Allow any in internal type casts
      '@typescript-eslint/no-explicit-any': 'warn',
      // Vue specific
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'warn',
      'vue/require-default-prop': 'off',
      // Allow void for fire-and-forget async
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Disable formatting rules handled by Prettier
  prettier,
)
