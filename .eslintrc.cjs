module.exports = {
  root: true,
  env: { browser: true, es2020: true, "vitest-globals/env": true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    "plugin:vitest/recommended",
    "plugin:vitest-globals/recommended"
  ],
  ignorePatterns: ['dist', 'coverage', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh', "vitest"],
  rules: {
    "no-mixed-operators": "off",
    'no-case-declarations': 'off',
    'no-irregular-whitespace': 'off',
    'no-inner-declarations': 'off',
    'no-unused-vars': ['warn', {
      "varsIgnorePattern": "^_+$",
      "argsIgnorePattern": "^_"
    }],
    'no-regex-spaces': 'off',
    'no-prototype-builtins': 'warn',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'vitest/prefer-to-be': "off",
    'vitest/no-commented-out-tests': 'off',
  },
}
