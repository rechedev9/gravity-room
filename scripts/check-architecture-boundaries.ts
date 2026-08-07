import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, posix, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set(['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);
const IGNORED_DIRECTORIES = new Set(['.expo', '.turbo', 'coverage', 'dist', 'node_modules']);
const APPLICATION_WORKSPACE_ROOTS = ['apps/backend', 'apps/frontend'] as const;

const SCAN_TARGETS = [
  'apps/frontend/web/src',
  'apps/frontend/mobile/src',
  'apps/frontend/mobile/App.tsx',
  'apps/frontend/mobile/index.js',
  'apps/backend/api/src',
  'packages/domain',
  'packages/api-client',
  'packages/database',
] as const;

type Zone =
  | 'web-runtime'
  | 'web-tooling'
  | 'mobile-runtime'
  | 'backend-app'
  | 'other-app'
  | 'domain'
  | 'api-client'
  | 'database'
  | 'unclassified';

interface ArchitectureRule {
  readonly id: string;
  readonly description: string;
  readonly source: Zone;
  readonly forbiddenTargets: ReadonlySet<Zone>;
}

export interface SourceTextFile {
  readonly path: string;
  readonly source: string;
}

export interface WorkspaceApplication {
  readonly name: string;
  readonly root: string;
}

export interface ArchitectureViolation {
  readonly ruleId: string;
  readonly description: string;
  readonly sourcePath: string;
  readonly line: number;
  readonly column: number;
  readonly specifier: string;
}

interface ModuleReference {
  readonly specifier: string;
  readonly line: number;
  readonly column: number;
}

const APP_ZONES = new Set<Zone>([
  'web-runtime',
  'web-tooling',
  'mobile-runtime',
  'backend-app',
  'other-app',
]);

const RULES: readonly ArchitectureRule[] = [
  {
    id: 'web-runtime-isolation',
    description:
      'Web runtime source must not depend on mobile, backend, other apps, or database code.',
    source: 'web-runtime',
    forbiddenTargets: new Set<Zone>([
      'web-tooling',
      'mobile-runtime',
      'backend-app',
      'other-app',
      'database',
    ]),
  },
  {
    id: 'mobile-runtime-isolation',
    description:
      'Mobile runtime source must not depend on web, backend, other apps, or database code.',
    source: 'mobile-runtime',
    forbiddenTargets: new Set<Zone>([
      'web-runtime',
      'web-tooling',
      'backend-app',
      'other-app',
      'database',
    ]),
  },
  {
    id: 'backend-runtime-dependency-direction',
    description:
      'Backend runtime may depend on domain and database, but not on frontends, other apps, or API client.',
    source: 'backend-app',
    forbiddenTargets: new Set<Zone>([
      'web-runtime',
      'web-tooling',
      'mobile-runtime',
      'other-app',
      'api-client',
    ]),
  },
  {
    id: 'domain-dependency-direction',
    description: 'Domain must remain foundational and cannot depend on apps or adapter packages.',
    source: 'domain',
    forbiddenTargets: new Set<Zone>([...APP_ZONES, 'api-client', 'database']),
  },
  {
    id: 'api-client-dependency-direction',
    description: 'API client may depend on domain, but not on apps or database.',
    source: 'api-client',
    forbiddenTargets: new Set<Zone>([...APP_ZONES, 'database']),
  },
  {
    id: 'database-dependency-direction',
    description: 'Database may depend on domain, but not on apps or API client.',
    source: 'database',
    forbiddenTargets: new Set<Zone>([...APP_ZONES, 'api-client']),
  },
];

function normalizeRepoPath(path: string): string {
  return posix.normalize(path.replaceAll('\\', '/')).replace(/^\.\//, '');
}

function isWithin(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

function isWebTestPath(path: string): boolean {
  return isWithin(path, 'apps/frontend/web/src') && /\.(?:test|spec)(?:\.[^/]+)?$/.test(path);
}

function classifyTargetPath(path: string): Zone {
  const normalized = normalizeRepoPath(path);

  if (isWebTestPath(normalized)) return 'web-tooling';
  if (isWithin(normalized, 'apps/frontend/web/src')) return 'web-runtime';
  if (isWithin(normalized, 'apps/frontend/web')) return 'web-tooling';
  if (isWithin(normalized, 'apps/frontend/mobile')) return 'mobile-runtime';
  if (isWithin(normalized, 'apps/backend/api')) return 'backend-app';
  if (isWithin(normalized, 'api')) return 'backend-app';
  if (isWithin(normalized, 'apps')) return 'other-app';
  if (isWithin(normalized, 'packages/domain')) return 'domain';
  if (isWithin(normalized, 'packages/api-client')) return 'api-client';
  if (isWithin(normalized, 'packages/database')) return 'database';
  return 'unclassified';
}

function classifySourcePath(path: string): Zone {
  const normalized = normalizeRepoPath(path);
  if (isWebTestPath(normalized)) return 'web-tooling';
  return classifyTargetPath(normalized);
}

function resolveTargetPath(
  sourcePath: string,
  specifier: string,
  workspaceApplications: readonly WorkspaceApplication[]
): string | undefined {
  for (const [packageName, packageRoot] of [
    ['@gzclp/domain', 'packages/domain'],
    ['@gzclp/api-client', 'packages/api-client'],
    ['@gzclp/database', 'packages/database'],
  ] as const) {
    if (specifier === packageName || specifier.startsWith(`${packageName}/`)) {
      return `${packageRoot}${specifier.slice(packageName.length)}`;
    }
  }

  for (const application of workspaceApplications) {
    if (specifier === application.name || specifier.startsWith(`${application.name}/`)) {
      return `${application.root}${specifier.slice(application.name.length)}`;
    }
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const resolved = posix.normalize(posix.join(posix.dirname(sourcePath), specifier));
    return resolved.startsWith('../') ? undefined : resolved;
  }

  if (specifier.startsWith('apps/') || specifier.startsWith('packages/')) {
    return posix.normalize(specifier);
  }

  return undefined;
}

function scriptKind(path: string): ts.ScriptKind {
  switch (extname(path).toLowerCase()) {
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.tsx':
      return ts.ScriptKind.TSX;
    default:
      return ts.ScriptKind.TS;
  }
}

function extractModuleReferences(file: SourceTextFile): readonly ModuleReference[] {
  const sourceFile = ts.createSourceFile(
    file.path,
    file.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file.path)
  );
  const references: ModuleReference[] = [];

  function record(node: ts.StringLiteralLike): void {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    references.push({
      specifier: node.text,
      line: position.line + 1,
      column: position.character + 1,
    });
  }

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      record(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      record(node.moduleReference.expression);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      record(node.argument.literal);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const argument = node.arguments[0];
      if ((isDynamicImport || isRequire) && argument && ts.isStringLiteralLike(argument)) {
        record(argument);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return references;
}

export function findArchitectureViolations(
  files: readonly SourceTextFile[],
  workspaceApplications: readonly WorkspaceApplication[] = []
): readonly ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];

  for (const file of files) {
    const sourcePath = normalizeRepoPath(file.path);
    const sourceZone = classifySourcePath(sourcePath);
    const rule = RULES.find((candidate) => candidate.source === sourceZone);
    if (!rule) continue;

    for (const reference of extractModuleReferences({ ...file, path: sourcePath })) {
      const targetPath = resolveTargetPath(sourcePath, reference.specifier, workspaceApplications);
      if (!targetPath) continue;

      const targetZone = classifyTargetPath(targetPath);
      if (!rule.forbiddenTargets.has(targetZone)) continue;

      violations.push({
        ruleId: rule.id,
        description: rule.description,
        sourcePath,
        line: reference.line,
        column: reference.column,
        specifier: reference.specifier,
      });
    }
  }

  return violations.sort(
    (left, right) =>
      left.sourcePath.localeCompare(right.sourcePath) ||
      left.line - right.line ||
      left.column - right.column
  );
}

function discoverWorkspaceApplications(repositoryRoot: string): readonly WorkspaceApplication[] {
  const applications: WorkspaceApplication[] = [];

  for (const workspaceRoot of APPLICATION_WORKSPACE_ROOTS) {
    const absoluteWorkspaceRoot = resolve(repositoryRoot, workspaceRoot);
    const entries = readdirSync(absoluteWorkspaceRoot, { withFileTypes: true }).sort(
      (left, right) => left.name.localeCompare(right.name)
    );

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const applicationRoot = `${workspaceRoot}/${entry.name}`;
      const manifestPath = resolve(repositoryRoot, applicationRoot, 'package.json');
      if (!existsSync(manifestPath)) continue;

      let manifest: unknown;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      } catch (error) {
        throw new Error(`Cannot parse workspace application manifest: ${manifestPath}`, {
          cause: error,
        });
      }

      if (
        typeof manifest !== 'object' ||
        manifest === null ||
        !('name' in manifest) ||
        typeof manifest.name !== 'string' ||
        manifest.name.length === 0
      ) {
        throw new Error(`Workspace application manifest has no valid name: ${manifestPath}`);
      }

      applications.push({ name: manifest.name, root: applicationRoot });
    }
  }

  return applications.sort((left, right) => left.name.localeCompare(right.name));
}

function collectSourceFiles(repositoryRoot: string): readonly SourceTextFile[] {
  const files: SourceTextFile[] = [];

  function collect(path: string): void {
    const entries = readdirSync(path, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name)
    );

    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;

      const entryPath = resolve(path, entry.name);
      if (entry.isDirectory()) {
        collect(entryPath);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        files.push({
          path: normalizeRepoPath(relative(repositoryRoot, entryPath)),
          source: readFileSync(entryPath, 'utf8'),
        });
      }
    }
  }

  for (const target of SCAN_TARGETS) {
    const absoluteTarget = resolve(repositoryRoot, target);
    if (SOURCE_EXTENSIONS.has(extname(target).toLowerCase())) {
      files.push({ path: target, source: readFileSync(absoluteTarget, 'utf8') });
    } else {
      collect(absoluteTarget);
    }
  }

  return files;
}

export function checkRepositoryArchitecture(
  repositoryRoot: string
): readonly ArchitectureViolation[] {
  return findArchitectureViolations(
    collectSourceFiles(repositoryRoot),
    discoverWorkspaceApplications(repositoryRoot)
  );
}

function runCli(): void {
  const violations = checkRepositoryArchitecture(process.cwd());
  if (violations.length === 0) {
    console.log('Architecture boundaries OK.');
    return;
  }

  console.error(`Architecture boundary check failed with ${violations.length} violation(s):`);
  for (const violation of violations) {
    console.error(
      `- ${violation.sourcePath}:${violation.line}:${violation.column} [${violation.ruleId}] ` +
        `${violation.specifier}\n  ${violation.description}`
    );
  }
  process.exitCode = 1;
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(resolve(entrypoint)).href) {
  runCli();
}
