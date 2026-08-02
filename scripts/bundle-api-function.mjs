/**
 * Generate the committed Vercel API bundle from an independent source entry.
 *
 * Vercel's Node runtime does not bundle extensionless ESM workspace imports, so
 * esbuild inlines first-party code while leaving real node_modules external for
 * Vercel's dependency tracer. `api/index.ts` is output only; using it as input
 * would silently preserve stale gateway code on subsequent builds.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { format, resolveConfig } from 'prettier';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(repoRoot, 'apps', 'backend', 'api', 'src', 'vercel-handler.ts');
const output = join(repoRoot, 'api', 'index.ts');
const checkOnly = process.argv.includes('--check');

/**
 * Externalize every bare specifier (real node_modules + node: builtins) so only
 * first-party code (relative paths + @gzclp workspace packages) is bundled.
 */
const externalizeNodeModules = {
  name: 'externalize-node-modules',
  setup(builder) {
    builder.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === 'entry-point') return undefined;
      const specifier = args.path;
      const isRelative =
        specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('\\');
      const isFirstPartyPackage = specifier.startsWith('@gzclp/');
      if (!isRelative && !isFirstPartyPackage) {
        return { path: specifier, external: true };
      }
      return undefined;
    });
  },
};

const result = await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  plugins: [externalizeNodeModules],
  legalComments: 'none',
  logLevel: 'info',
});

const generated = result.outputFiles?.[0]?.text;
if (generated === undefined) {
  throw new Error('esbuild did not produce the Vercel API bundle');
}
const prettierConfig = (await resolveConfig(output)) ?? {};
const formatted = await format(generated, {
  ...prettierConfig,
  filepath: output,
  parser: 'typescript',
});

if (checkOnly) {
  let committed;
  try {
    committed = await readFile(output, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read committed API bundle at ${output}`, { cause: error });
  }
  if (committed !== formatted) {
    throw new Error(
      'api/index.ts is stale. Run `pnpm run bundle:api` and commit the generated bundle.'
    );
  }
  console.log('[bundle-api-function] committed api/index.ts matches its source entry');
} else {
  await writeFile(output, formatted);
  console.log('[bundle-api-function] generated api/index.ts from vercel-handler.ts');
}
