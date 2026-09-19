import tseslint from 'typescript-eslint';

const crossAppImports = {
  group: [
    '**/backend',
    '**/backend/**',
    '**/web',
    '**/web/**',
    '**/packages/database',
    '**/packages/database/**',
    '@gzclp/database',
    '@gzclp/database/*',
  ],
  message:
    'Mobile uses shared domain/API contracts; server and web implementations stay in their apps.',
};

const testOnlyImports = {
  group: ['**/testing', '**/testing/**'],
  message: 'Test adapters belong to regression tests, not the mobile runtime.',
};

export default tseslint.config(
  ...tseslint.configs.recommended,
  { ignores: ['node_modules/**', '.expo/**', 'dist/**', 'android/**', 'ios/**'] },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': true },
      ],
      // Named unused parameters document callback signatures; unused bindings still fail.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-imports': ['error', { patterns: [crossAppImports, testOnlyImports] }],
    },
  },
  {
    files: ['src/lib/**/*.ts', 'src/lib/**/*.tsx', 'src/lib/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            crossAppImports,
            testOnlyImports,
            {
              group: [
                '**/shell',
                '**/shell/**',
                '**/features',
                '**/features/**',
                '**/ui',
                '**/ui/**',
                '**/app',
                '**/app/**',
              ],
              message:
                'Library code must not depend on screens, shell providers, UI, or routes. Inject the needed behavior.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.test.js'],
    rules: {
      // Jest mock factories and the existing SQLite integration harness use require.
      '@typescript-eslint/no-require-imports': 'off',
      // Integration tests may compose a library with its real shell provider.
      'no-restricted-imports': ['error', { patterns: [crossAppImports] }],
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': false },
      ],
    },
  }
);
