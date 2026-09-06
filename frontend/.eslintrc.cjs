module.exports = {
  root: true,

  env: {
    browser: true,
    es2020: true,
  },

  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],

  ignorePatterns: [
    'dist',
    'public/libs/**',
    '.eslintrc.cjs',
  ],

  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },

  plugins: [
    'react-refresh',
  ],

  settings: {
    react: {
      version: 'detect',
    },
  },

  rules: {
    'no-unused-vars': [
      'error',
      { varsIgnorePattern: '^React$' },
    ],
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',

    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },

  overrides: [
    {
      files: ['src/i18n/LanguageContext.jsx'],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
    {
      files: ['src/pages/Dashboard.jsx'],
      rules: {
        'react-hooks/exhaustive-deps': 'off',
      },
    },
  ],
};
