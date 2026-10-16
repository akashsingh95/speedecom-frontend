import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import react from 'eslint-plugin-react'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  {
    ignores: ['dist', 'node_modules', 'build'],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      react,
    },
    rules: {
      // QUICK DEPLOYMENT MODE - All warnings only
      'no-unused-vars': 'warn',
      // Marks an import as used when it appears only in JSX (<Modal />, <Link />). Without it
      // no-unused-vars false-positives on every JSX-only import, which is why ~55 files carried
      // a file-wide `eslint-disable no-unused-vars` header. Reports nothing itself.
      'react/jsx-uses-vars': 'warn',
      'no-undef': 'warn',
      'no-empty': 'warn',
      'no-constant-condition': 'warn',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
])
