import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findArchitectureViolations,
  type SourceTextFile,
  type WorkspaceApplication,
} from './check-architecture-boundaries';

interface BoundaryTestCase {
  readonly name: string;
  readonly file: SourceTextFile;
  readonly expectedRuleIds: readonly string[];
}

const workspaceApplications: readonly WorkspaceApplication[] = [
  { name: 'api', root: 'apps/backend/api' },
  { name: 'mobile', root: 'apps/frontend/mobile' },
  { name: 'web', root: 'apps/frontend/web' },
  { name: 'worker-service', root: 'apps/backend/worker' },
];

function findFixtureViolations(files: readonly SourceTextFile[]) {
  return findArchitectureViolations(files, workspaceApplications);
}

describe('architecture dependency rules', () => {
  const cases: readonly BoundaryTestCase[] = [
    {
      name: 'allows web runtime to consume shared domain and API client packages',
      file: {
        path: 'apps/frontend/web/src/example.ts',
        source: `
          import { computeGenericProgram } from '@gzclp/domain/generic-engine';
          export { ApiError } from '@gzclp/api-client/api-error';
        `,
      },
      expectedRuleIds: [],
    },
    {
      name: 'blocks database imports from web runtime source',
      file: {
        path: 'apps/frontend/web/src/example.ts',
        source: `import { users } from '@gzclp/database/schema';`,
      },
      expectedRuleIds: ['web-runtime-isolation'],
    },
    {
      name: 'allows the documented web prerender tooling dependency on database seeds',
      file: {
        path: 'apps/frontend/web/scripts/prerender.ts',
        source: `import { GZCLP } from '@gzclp/database/seeds/programs/gzclp';`,
      },
      expectedRuleIds: [],
    },
    {
      name: 'blocks web runtime from importing exempt web tooling',
      file: {
        path: 'apps/frontend/web/src/example.ts',
        source: `import '../scripts/prerender';`,
      },
      expectedRuleIds: ['web-runtime-isolation'],
    },
    {
      name: 'blocks web and mobile runtime cross-imports',
      file: {
        path: 'apps/frontend/web/src/example.ts',
        source: `import 'apps/frontend/mobile/src/app/App';`,
      },
      expectedRuleIds: ['web-runtime-isolation'],
    },
    {
      name: 'blocks web runtime from importing another app',
      file: {
        path: 'apps/frontend/web/src/example.ts',
        source: `import 'apps/worker/src/main';`,
      },
      expectedRuleIds: ['web-runtime-isolation'],
    },
    {
      name: 'resolves an injected workspace package name to another app',
      file: {
        path: 'apps/frontend/web/src/example.ts',
        source: `import 'worker-service/jobs';`,
      },
      expectedRuleIds: ['web-runtime-isolation'],
    },
    {
      name: 'blocks web imports from the mobile root entrypoint',
      file: {
        path: 'apps/frontend/mobile/App.tsx',
        source: `import 'apps/frontend/web/src/main';`,
      },
      expectedRuleIds: ['mobile-runtime-isolation'],
    },
    {
      name: 'blocks backend imports from mobile runtime source',
      file: {
        path: 'apps/frontend/mobile/src/example.ts',
        source: `const api = import('apps/backend/api/src/create-app');`,
      },
      expectedRuleIds: ['mobile-runtime-isolation'],
    },
    {
      name: 'blocks mobile runtime from importing another app',
      file: {
        path: 'apps/frontend/mobile/src/example.ts',
        source: `import 'apps/worker/src/main';`,
      },
      expectedRuleIds: ['mobile-runtime-isolation'],
    },
    {
      name: 'allows backend runtime to consume domain and database',
      file: {
        path: 'apps/backend/api/src/example.ts',
        source: `
          import { isRecord } from '@gzclp/domain/type-guards';
          import { users } from '@gzclp/database/schema';
        `,
      },
      expectedRuleIds: [],
    },
    {
      name: 'blocks backend runtime from importing web',
      file: {
        path: 'apps/backend/api/src/example.ts',
        source: `import 'web/src/main';`,
      },
      expectedRuleIds: ['backend-runtime-dependency-direction'],
    },
    {
      name: 'blocks backend runtime from importing mobile',
      file: {
        path: 'apps/backend/api/src/example.ts',
        source: `import 'mobile/src/app/App';`,
      },
      expectedRuleIds: ['backend-runtime-dependency-direction'],
    },
    {
      name: 'blocks backend runtime from importing another app',
      file: {
        path: 'apps/backend/api/src/example.ts',
        source: `import 'apps/worker/src/main';`,
      },
      expectedRuleIds: ['backend-runtime-dependency-direction'],
    },
    {
      name: 'classifies a sibling backend service as another app',
      file: {
        path: 'apps/backend/api/src/example.ts',
        source: `import 'apps/backend/worker/src/main';`,
      },
      expectedRuleIds: ['backend-runtime-dependency-direction'],
    },
    {
      name: 'blocks backend runtime from importing client transport',
      file: {
        path: 'apps/backend/api/src/example.ts',
        source: `import { requestJson } from '@gzclp/api-client';`,
      },
      expectedRuleIds: ['backend-runtime-dependency-direction'],
    },
    {
      name: 'keeps domain independent from applications',
      file: {
        path: 'packages/domain/src/example.ts',
        source: `import type { App } from '../../../apps/backend/api/src/create-app';`,
      },
      expectedRuleIds: ['domain-dependency-direction'],
    },
    {
      name: 'recognizes private workspace application package names',
      file: {
        path: 'packages/domain/src/example.ts',
        source: `import type { Api } from 'api';`,
      },
      expectedRuleIds: ['domain-dependency-direction'],
    },
    {
      name: 'keeps domain independent from adapter packages',
      file: {
        path: 'packages/domain/src/example.ts',
        source: `export { ApiError } from '@gzclp/api-client/api-error';`,
      },
      expectedRuleIds: ['domain-dependency-direction'],
    },
    {
      name: 'blocks dependency reversals expressed as import types',
      file: {
        path: 'packages/domain/src/example.ts',
        source: `type DatabaseUser = import('@gzclp/database/schema').User;`,
      },
      expectedRuleIds: ['domain-dependency-direction'],
    },
    {
      name: 'allows API client to depend on domain',
      file: {
        path: 'packages/api-client/src/example.ts',
        source: `const guards = require('@gzclp/domain/type-guards');`,
      },
      expectedRuleIds: [],
    },
    {
      name: 'blocks API client from depending on database',
      file: {
        path: 'packages/api-client/src/example.ts',
        source: `import '@gzclp/database/schema';`,
      },
      expectedRuleIds: ['api-client-dependency-direction'],
    },
    {
      name: 'allows database to depend on domain',
      file: {
        path: 'packages/database/src/example.ts',
        source: `import { isRecord } from '@gzclp/domain/type-guards';`,
      },
      expectedRuleIds: [],
    },
    {
      name: 'blocks database from reversing into API client',
      file: {
        path: 'packages/database/src/example.ts',
        source: `import client = require('@gzclp/api-client');`,
      },
      expectedRuleIds: ['database-dependency-direction'],
    },
    {
      name: 'ignores import-looking text in comments and strings',
      file: {
        path: 'packages/domain/src/example.ts',
        source: `
          // import 'apps/frontend/web/src/main';
          const documentation = "import '@gzclp/database/schema'";
        `,
      },
      expectedRuleIds: [],
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      const violations = findFixtureViolations([testCase.file]);
      assert.deepEqual(
        violations.map((violation) => violation.ruleId),
        testCase.expectedRuleIds
      );
    });
  }
});

describe('architecture violation diagnostics', () => {
  it('blocks runtime imports of exempt test bridges without evaluating the bridge as runtime', () => {
    const violations = findFixtureViolations([
      {
        path: 'apps/frontend/web/src/runtime.ts',
        source: `import './bridge.test';`,
      },
      {
        path: 'apps/frontend/web/src/bridge.test.ts',
        source: `import '@gzclp/database/schema';`,
      },
    ]);

    assert.deepEqual(
      violations.map(({ sourcePath, specifier }) => ({ sourcePath, specifier })),
      [{ sourcePath: 'apps/frontend/web/src/runtime.ts', specifier: './bridge.test' }]
    );
  });

  it('reports each forbidden module with a source position', () => {
    const violations = findFixtureViolations([
      {
        path: 'apps/frontend/web/src/example.ts',
        source: `import '@gzclp/database/schema';\nimport 'apps/backend/api/src/create-app';`,
      },
    ]);

    assert.deepEqual(
      violations.map(({ line, column, specifier }) => ({ line, column, specifier })),
      [
        { line: 1, column: 8, specifier: '@gzclp/database/schema' },
        { line: 2, column: 8, specifier: 'apps/backend/api/src/create-app' },
      ]
    );
  });
});
