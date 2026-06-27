/**
 * Pre-bundle the Vercel serverless API function into a single self-contained
 * ESM module, run by scripts/vercel-build.sh at build time.
 *
 * Why this exists
 * ----------------
 * The API is an ESM workspace (apps/backend/api is "type":"module") written with
 * extensionless relative imports (the standard TypeScript style). @vercel/node
 * does NOT bundle the function: it transpiles each .ts to .js and ships them, so
 * at runtime Node's ESM loader sees extensionless relative imports
 * (`./create-app`, `../analytics/...`) and rejects them with
 * ERR_MODULE_NOT_FOUND (and, before the root became "type":"module",
 * ERR_REQUIRE_ESM). Bundling resolves every first-party import at build time.
 *
 * What it does
 * ------------
 * esbuild-bundles api/index.ts, inlining all first-party code — relative
 * imports AND the @gzclp/* workspace packages — while leaving every real
 * node_module (elysia, drizzle-orm, postgres, @upstash/*, pino, @node-rs/argon2,
 * node: builtins, ...) external. @vercel/node then traces those externals from
 * node_modules as usual. The bundle overwrites api/index.ts in place so the
 * Vercel function mapping (api/index.ts -> /api/*) is unchanged; only the
 * checked-out build copy is rewritten, never the committed source.
 */
import { build } from 'esbuild';
import { rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(repoRoot, 'api', 'index.ts');
const tmpOut = join(repoRoot, 'api-function.bundle.mjs');

/**
 * Externalize every bare specifier (real node_modules + node: builtins) so only
 * first-party code (relative paths + the @gzclp/* workspace packages) is bundled.
 * Driving this off the import kind/shape — rather than a hardcoded deps list —
 * keeps transitive node_modules external without enumerating them.
 */
const externalizeNodeModules = {
  name: 'externalize-node-modules',
  setup(builder) {
    builder.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === 'entry-point') return undefined;
      const p = args.path;
      const isRelative = p.startsWith('.') || p.startsWith('/') || p.startsWith('\\');
      const isFirstPartyPkg = p.startsWith('@gzclp/');
      if (!isRelative && !isFirstPartyPkg) {
        return { path: p, external: true };
      }
      return undefined;
    });
  },
};

await build({
  entryPoints: [entry],
  outfile: tmpOut,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  plugins: [externalizeNodeModules],
  legalComments: 'none',
  logLevel: 'info',
});

await rename(tmpOut, entry);
console.log('[bundle-api-function] wrote self-contained bundle to api/index.ts');
