import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ESLint } from 'eslint';

const cwd = fileURLToPath(new URL('../apps/frontend/mobile/', import.meta.url));
const eslint = new ESLint({ cwd });

async function lint(code, filePath = 'src/lib/example.ts') {
  const [result] = await eslint.lintText(code, { filePath });
  assert.ok(result, 'ESLint must evaluate the fixture');
  assert.equal(result.fatalErrorCount, 0, 'fixtures must parse before rules are evaluated');
  return result.messages;
}

async function rejects(code, rule, filePath) {
  const messages = await lint(code, filePath);
  assert.ok(
    messages.some((message) => message.ruleId === rule),
    JSON.stringify(messages)
  );
}

test('mobile production code rejects explicit any', async () => {
  await rejects('export const value: any = 1;', '@typescript-eslint/no-explicit-any');
});

test('mobile production code rejects silence casts and non-null assertions', async () => {
  await rejects(
    'export const value = 1 as unknown;',
    '@typescript-eslint/consistent-type-assertions'
  );
  await rejects('export const first = [1][0]!;', '@typescript-eslint/no-non-null-assertion');
});

test('mobile production code rejects TypeScript suppression comments', async () => {
  for (const comment of ['@ts-ignore', '@ts-expect-error']) {
    await rejects(
      `// ${comment}: intentional fixture\nexport const value = 1;`,
      '@typescript-eslint/ban-ts-comment'
    );
  }
});

test('unused callback parameters may document signatures but unused bindings fail', async () => {
  assert.deepEqual(await lint('export const callback = (_value: string) => undefined;'), []);
  await rejects('const _unused = 1; export const value = 2;', '@typescript-eslint/no-unused-vars');
});

test('production console logging fails while warn/error are permitted', async () => {
  await rejects('console.log("diagnostic");', 'no-console');
  assert.deepEqual(await lint('console.warn("diagnostic"); console.error("failure");'), []);
});

test('module require calls are rejected, including bundled image assets', async () => {
  await rejects(
    'export const image = require("../../assets/program.webp");',
    '@typescript-eslint/no-require-imports'
  );
  await rejects(
    'export const service = require("./service");',
    '@typescript-eslint/no-require-imports'
  );
});

test('shared domain and API contracts remain available to mobile libraries', async () => {
  assert.deepEqual(
    await lint(`
    import { value } from '@gzclp/domain';
    import { request } from '@gzclp/api-client';
    export const result = request(value);
  `),
    []
  );
});

test('mobile cannot import server database or implementation modules', async () => {
  for (const target of [
    '@gzclp/database',
    '@gzclp/database/schema',
    '../../../../../backend/api/src/create-app',
    '../../../../../frontend/web/src/lib/api',
  ]) {
    await rejects(`import { value } from '${target}'; export { value };`, 'no-restricted-imports');
  }
});

test('libraries reject upward dependencies including type-only imports and re-exports', async () => {
  for (const target of [
    '../../shell/auth-provider',
    '../../features/tracker/tracker-screen',
    '../../ui/button',
    '../../app/_layout',
  ]) {
    await rejects(`import { value } from '${target}'; export { value };`, 'no-restricted-imports');
    await rejects(
      `import type { Value } from '${target}'; export type Result = Value;`,
      'no-restricted-imports'
    );
    await rejects(`export { value } from '${target}';`, 'no-restricted-imports');
  }
});

test('screen and route composition can still consume shell providers and libraries', async () => {
  for (const file of ['src/features/example.tsx', 'src/app/example.tsx']) {
    assert.deepEqual(
      await lint(`import { value } from '../shell/providers'; export { value };`, file),
      []
    );
  }
});

test('Jest factories and explicit negative type fixtures retain their narrow exceptions', async () => {
  const code = `
    // @ts-expect-error: intentional negative type fixture
    export const value = require('./fixture') as unknown;
  `;
  assert.deepEqual(await lint(code, 'src/lib/example.test.ts'), []);
  await rejects(
    'export const value: any = 1;',
    '@typescript-eslint/no-explicit-any',
    'src/lib/example.test.ts'
  );
  await rejects(
    '// @ts-ignore: forbidden even in tests\nexport const value = 1;',
    '@typescript-eslint/ban-ts-comment',
    'src/lib/example.test.ts'
  );
});

test('plain JavaScript test harnesses are linted too', async () => {
  await rejects(
    'const unused = 1; module.exports = 2;',
    '@typescript-eslint/no-unused-vars',
    'src/lib/example.test.js'
  );
});

test('library integration tests may compose the real mobile shell, but not another app', async () => {
  assert.deepEqual(
    await lint(
      "import { Provider } from '../../shell/providers'; export { Provider };",
      'src/lib/example.test.tsx'
    ),
    []
  );
  await rejects(
    "import { db } from '@gzclp/database'; export { db };",
    'no-restricted-imports',
    'src/lib/example.test.ts'
  );
});

test('generated native projects and Expo outputs stay outside the source lint gate', async () => {
  for (const path of [
    'android/generated.ts',
    'ios/generated.ts',
    '.expo/types/router.d.ts',
    'dist/generated.js',
  ]) {
    assert.equal(await eslint.isPathIgnored(path), true, path);
  }
});

test('normal relative sibling imports cannot bypass cross-app boundaries', async () => {
  for (const target of [
    '../../../web/src/lib/api',
    '../../../web',
    '../../../../../packages/database/src/schema',
    '../../../../../packages/database',
    '../../../../backend',
    '../../../../backend/api/src/create-app',
  ]) {
    await rejects(`import { value } from '${target}'; export { value };`, 'no-restricted-imports');
  }
});

test('directory entry points cannot bypass library dependency direction', async () => {
  for (const directory of ['shell', 'features', 'ui', 'app']) {
    await rejects(
      `import { value } from '../../${directory}'; export { value };`,
      'no-restricted-imports'
    );
  }
});

test('test adapters stay available to tests and outside production imports', async () => {
  const code =
    "import { createSqliteTestAdapter } from '../../../testing/sqlite-adapter.cjs'; export { createSqliteTestAdapter };";
  await rejects(code, 'no-restricted-imports');
  await rejects(code, 'no-restricted-imports', 'src/features/example.ts');
  assert.deepEqual(await lint(code, 'src/lib/example.test.ts'), []);
});
