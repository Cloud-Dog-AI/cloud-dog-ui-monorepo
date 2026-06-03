module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jsx-a11y', 'react-hooks'],
  extends: [],
  ignorePatterns: ['dist/**'],
  rules: {
    'jsx-a11y/anchor-is-valid': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
