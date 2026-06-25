/**
 * Static prerender for the public sitemap.
 *
 * Why this exists: Gravity Room is a Vite SPA — every URL serves the same
 * `index.html` with empty `<title>`/meta until the React app hydrates. That
 * kills the SEO/GEO P0-1 audits: Google and AI crawlers index the *raw* HTML
 * for canonical URLs, OG previews, and FAQ/HowTo answers, and the raw HTML
 * had nothing route-specific.
 *
 * What it does: after `vite build` produces `dist/`, this script
 *   1. boots `vite preview` on a local port,
 *   2. spins up Playwright headless Chromium and intercepts `/api/catalog/*`
 *      with hydrated fixtures built from the API seed JSONB + the shared
 *      `PROGRAM_CATALOG` metadata in `@gzclp/domain` — no live API needed,
 *   3. visits every URL in `apps/frontend/web/public/sitemap.xml` plus `/login`,
 *      waits for `useHead` (in `src/hooks/use-head.ts`) and the per-program
 *      JSON-LD to mutate the DOM, then dumps the serialised HTML to
 *      `dist/<path>/index.html`,
 *   4. writes a `dist/404.html` with `<meta name="robots" content="noindex">`
 *      so the Caddy `handle_errors` block has a real target.
 *
 * Why Playwright (not vite-plugin-prerender / react-snap): Vite 7 + React 19
 * + TanStack Router + lazy chunks need a real browser to settle.
 * `@playwright/test` is already a devDependency for e2e — no new install.
 */
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { connect, createServer } from 'node:net';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContext } from '@playwright/test';

import { PROGRAM_CATALOG } from '@gzclp/domain/catalog';
import { ProgramDefinitionSchema } from '@gzclp/domain/schemas/program-definition';
import type { ProgramDefinition } from '@gzclp/domain/types/program';

import { GZCLP_DEFINITION_JSONB } from '@gzclp/database/seeds/programs/gzclp';
import { PPL531_DEFINITION_JSONB } from '@gzclp/database/seeds/programs/ppl531';
import { STRONGLIFTS_DEFINITION_JSONB } from '@gzclp/database/seeds/programs/stronglifts';
import { GSLP_DEFINITION_JSONB } from '@gzclp/database/seeds/programs/greyskull';
import { BBB_DEFINITION_JSONB } from '@gzclp/database/seeds/programs/bbb';
import { FSL531_DEFINITION_JSONB } from '@gzclp/database/seeds/programs/fsl531';
import { PHUL_DEFINITION_JSONB } from '@gzclp/database/seeds/programs/phul';
import { NIVEL7_DEFINITION_JSONB } from '@gzclp/database/seeds/programs/nivel7';
import { MUTENROSHI_DEFINITION_JSONB } from '@gzclp/database/seeds/programs/mutenroshi';
import {
  BRUNETTI365_DEFINITION_JSONB,
  BRUNETTI365_EXP_DEFINITION_JSONB,
} from '@gzclp/database/seeds/programs/brunetti-365';
import { SHEIKO_7_1_DEFINITION } from '@gzclp/database/seeds/programs/sheiko-7-1';
import { SHEIKO_7_2_DEFINITION } from '@gzclp/database/seeds/programs/sheiko-7-2';
import { SHEIKO_7_3_DEFINITION } from '@gzclp/database/seeds/programs/sheiko-7-3';
import { SHEIKO_7_4_DEFINITION } from '@gzclp/database/seeds/programs/sheiko-7-4';
import { SHEIKO_7_5_DEFINITION } from '@gzclp/database/seeds/programs/sheiko-7-5';
import { SALA_1_DEFINITION_JSONB } from '@gzclp/database/seeds/programs/sala-1';
import { SALA_2_DEFINITION_JSONB } from '@gzclp/database/seeds/programs/sala-2';
import { SALA_3_DEFINITION_JSONB } from '@gzclp/database/seeds/programs/sala-3';
import { PPL_AB_DEFINITION_JSONB } from '@gzclp/database/seeds/programs/ppl-ab';

// ---------------------------------------------------------------------------
// Paths & config
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const DIST_DIR = resolve(WEB_ROOT, 'dist');
const SITEMAP_PATH = resolve(WEB_ROOT, 'public/sitemap.xml');
const PREVIEW_HOST = '127.0.0.1';

// Per-route hydration deadline. Most routes settle well under 1.5 s; we give
// 5 s before treating a render as stuck.
const ROUTE_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Program JSONB lookup — mirrors packages/database/src/seeds/program-templates-seed.ts
// ---------------------------------------------------------------------------

const DEFINITION_MAP: Readonly<Record<string, unknown>> = {
  gzclp: GZCLP_DEFINITION_JSONB,
  'hexan-ppl': PPL531_DEFINITION_JSONB,
  'stronglifts-5x5': STRONGLIFTS_DEFINITION_JSONB,
  'phraks-greyskull-lp': GSLP_DEFINITION_JSONB,
  '531-boring-but-big': BBB_DEFINITION_JSONB,
  '531-for-beginners': FSL531_DEFINITION_JSONB,
  phul: PHUL_DEFINITION_JSONB,
  'nivel-7': NIVEL7_DEFINITION_JSONB,
  'caparazon-de-tortuga': MUTENROSHI_DEFINITION_JSONB,
  '365-programmare-lipertrofia': BRUNETTI365_DEFINITION_JSONB,
  'la-sala-del-tiempo': BRUNETTI365_EXP_DEFINITION_JSONB,
  'tenkaichi-budokai-sentadilla': SHEIKO_7_1_DEFINITION,
  'tenkaichi-budokai-press-banca': SHEIKO_7_2_DEFINITION,
  'tenkaichi-budokai-peso-muerto': SHEIKO_7_3_DEFINITION,
  'tenkaichi-budokai-solo-banca': SHEIKO_7_4_DEFINITION,
  'tenkaichi-budokai-veterano': SHEIKO_7_5_DEFINITION,
  'sala-del-tiempo-1': SALA_1_DEFINITION_JSONB,
  'sala-del-tiempo-2': SALA_2_DEFINITION_JSONB,
  'sala-del-tiempo-3': SALA_3_DEFINITION_JSONB,
  'furia-oscura': PPL_AB_DEFINITION_JSONB,
};

// ---------------------------------------------------------------------------
// Definition builder
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectSlotIds(slots: readonly unknown[], ids: Set<string>): void {
  for (const slot of slots) {
    if (!isRecord(slot)) continue;
    if (typeof slot.exerciseId === 'string') ids.add(slot.exerciseId);
  }
}

function collectDayIds(days: readonly unknown[], ids: Set<string>): void {
  for (const day of days) {
    if (!isRecord(day)) continue;
    const slots = day.slots;
    if (Array.isArray(slots)) collectSlotIds(slots, ids);
  }
}

function collectExerciseIds(definition: unknown): Set<string> {
  const ids = new Set<string>();
  if (!isRecord(definition)) return ids;
  if (Array.isArray(definition.days)) collectDayIds(definition.days, ids);
  if (isRecord(definition.exercises)) {
    for (const key of Object.keys(definition.exercises)) ids.add(key);
  }
  return ids;
}

function buildProgramDefinition(programId: string): ProgramDefinition | null {
  const meta = PROGRAM_CATALOG.find((m) => m.id === programId);
  const jsonb = DEFINITION_MAP[programId];
  if (!meta || !isRecord(jsonb)) return null;

  const ids = collectExerciseIds(jsonb);
  const exerciseMap: Record<string, { readonly name: string }> = {};
  for (const id of ids) exerciseMap[id] = { name: id };

  const candidate = {
    ...jsonb,
    id: meta.id,
    name: meta.name,
    description: meta.description,
    author: meta.author,
    version: 1,
    category: meta.category,
    source: 'preset',
    exercises: exerciseMap,
  };

  const parsed = ProgramDefinitionSchema.safeParse(candidate);
  if (!parsed.success) {
    console.error(`[prerender] schema parse failed for ${programId}:`, parsed.error.message);
    return null;
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Sitemap parsing
// ---------------------------------------------------------------------------

async function readSitemapPaths(): Promise<readonly string[]> {
  const xml = await readFile(SITEMAP_PATH, 'utf8');
  const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
  const paths: string[] = [];
  for (const match of matches) {
    const url = new URL(match[1]);
    paths.push(url.pathname === '' ? '/' : url.pathname);
  }
  return paths;
}

// ---------------------------------------------------------------------------
// Vite preview server lifecycle
// ---------------------------------------------------------------------------

async function canOpenTcpConnection(host: string, port: number): Promise<boolean> {
  return new Promise((resolveProbe) => {
    const socket = connect({ host, port });
    const settle = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolveProbe(ok);
    };

    socket.setTimeout(1_000);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false));
  });
}

/**
 * Pick a free TCP port on the loopback. A hardcoded 4173 + `--strictPort` made
 * the prerender fail hard with "Port 4173 is already in use" whenever a prior
 * run left its preview server orphaned (common on Windows, where SIGTERM to the
 * `bunx` wrapper does not always reap the vite grandchild). An ephemeral port
 * sidesteps that entire class of port-collision failures.
 */
async function getFreePort(): Promise<number> {
  return new Promise((resolveProbe, rejectProbe) => {
    const srv = createServer();
    srv.unref();
    srv.once('error', rejectProbe);
    srv.listen(0, PREVIEW_HOST, () => {
      const address = srv.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      srv.close(() => resolveProbe(port));
    });
  });
}

/**
 * Best-effort kill of the preview process tree. `bunx` spawns vite as a
 * grandchild; on Windows a plain SIGTERM to `bunx` leaves vite bound to the
 * port, so reap the whole tree with taskkill.
 */
function killPreviewTree(child: ChildProcess): void {
  if (child.pid === undefined) {
    child.kill('SIGTERM');
    return;
  }
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function startPreviewServer(): Promise<{ child: ChildProcess; origin: string }> {
  const port = await getFreePort();
  const origin = `http://${PREVIEW_HOST}:${port}`;
  const child = spawn(
    'bunx',
    ['--bun', 'vite', 'preview', '--host', PREVIEW_HOST, '--port', String(port), '--strictPort'],
    {
      cwd: WEB_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      // On Windows, spawning a bare `bunx` without a shell raises ENOENT (it
      // resolves to bunx.cmd/.exe only through the shell's PATHEXT lookup).
      shell: process.platform === 'win32',
    }
  );

  child.stdout?.on('data', (buf: Buffer) => process.stdout.write(`[preview] ${buf.toString()}`));
  child.stderr?.on('data', (buf: Buffer) => process.stderr.write(`[preview!] ${buf.toString()}`));

  // TCP probe — more reliable than parsing stdout. Vite colours the port with
  // ANSI escapes so a naïve stdout `.includes()` is brittle across TTY/CI.
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await canOpenTcpConnection(PREVIEW_HOST, port)) return { child, origin };
    await new Promise((r) => setTimeout(r, 200));
  }
  killPreviewTree(child);
  throw new Error(`vite preview did not come up on ${origin}`);
}

// ---------------------------------------------------------------------------
// Per-route prerender
// ---------------------------------------------------------------------------

async function prerenderRoute(
  context: BrowserContext,
  origin: string,
  path: string
): Promise<string> {
  const page = await context.newPage();
  // Suppress noisy console output unless explicitly debugging.
  page.on('pageerror', (err) => console.error(`[prerender:${path}] pageerror:`, err.message));

  await page.goto(`${origin}${path}`, {
    waitUntil: 'networkidle',
    timeout: ROUTE_TIMEOUT_MS,
  });

  // Wait until the lazy route chunk has mounted its top-level DOM. We can't
  // use document.title alone — the index.html default already satisfies that
  // before the route component runs. Looking for the route's actual h1/text
  // would couple us to UI markup, so instead we let the page settle for a
  // hard 600 ms after networkidle; useHead's useEffect plus lazy chunk
  // resolution comfortably finish inside that window.
  await page.waitForTimeout(600);

  const html = await page.content();
  await page.close();
  return html;
}

// ---------------------------------------------------------------------------
// Output writers
// ---------------------------------------------------------------------------

async function writeRouteHtml(path: string, html: string): Promise<void> {
  // `/` -> dist/index.html, `/programs/gzclp` -> dist/programs/gzclp/index.html
  const trimmed = path === '/' ? '' : path.replace(/^\/+/, '').replace(/\/+$/, '');
  const outDir = trimmed === '' ? DIST_DIR : resolve(DIST_DIR, trimmed);
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'index.html'), html, 'utf8');
}

async function writeNotFoundFallback(): Promise<void> {
  // Reuse the prerendered output of the wildcard route (NotFound) — it already
  // contains the noindex meta from useHead.
  const wildcardSource = resolve(DIST_DIR, '__not_found__/index.html');
  const target = resolve(DIST_DIR, '404.html');
  if (existsSync(wildcardSource)) {
    const body = await readFile(wildcardSource, 'utf8');
    await writeFile(target, body, 'utf8');
    return;
  }
  // Fallback: synthetic minimal 404.
  await writeFile(
    target,
    `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>404 — Gravity Room</title></head><body><h1>404</h1><p>Page not found.</p></body></html>`,
    'utf8'
  );
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/**
 * Launch headless Chromium with a couple of retries. A cold or
 * resource-contended machine occasionally blows the launch timeout; a retry is
 * far cheaper than failing the whole build/deploy on a transient hiccup.
 */
async function launchChromiumWithRetry(attempts = 3): Promise<Browser> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await chromium.launch({ timeout: 60_000 });
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[prerender] chromium launch ${attempt}/${attempts} failed: ${msg}`);
      await new Promise((r) => setTimeout(r, 1_000 * attempt));
    }
  }
  throw lastErr;
}

async function main(): Promise<void> {
  if (!existsSync(DIST_DIR)) {
    throw new Error(`dist/ not found at ${DIST_DIR} — run \`vite build\` first.`);
  }

  const sitemapPaths = await readSitemapPaths();
  // Always include /login (auth landing) — not in sitemap on purpose, but still
  // a public route worth prerendering for hreflang + OG.
  const allPaths = Array.from(new Set([...sitemapPaths, '/login', '/__not_found__']));

  console.error(`[prerender] rendering ${allPaths.length} routes -> ${DIST_DIR}`);

  // Pre-build all program definitions so the route handler can serve them
  // synchronously without re-validating per request.
  const programDefs: Record<string, ProgramDefinition> = {};
  for (const meta of PROGRAM_CATALOG) {
    const def = buildProgramDefinition(meta.id);
    if (def !== null) programDefs[meta.id] = def;
  }

  const { child: previewServer, origin: previewOrigin } = await startPreviewServer();
  let browser: Browser | null = null;
  try {
    browser = await launchChromiumWithRetry();
    const context = await browser.newContext({
      // The build hardcodes VITE_API_URL into the bundle; the route below
      // intercepts the catalog endpoint regardless of which absolute origin
      // the bundle calls.
      viewport: { width: 1280, height: 800 },
    });

    // Intercept all catalog detail calls with hydrated fixtures.
    await context.route('**/api/catalog/*', async (route) => {
      const url = new URL(route.request().url());
      const segments = url.pathname.split('/').filter(Boolean);
      const programId = segments[segments.length - 1];
      const def = programDefs[programId];
      if (def !== undefined) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(def),
        });
      } else {
        await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      }
    });
    // Stub other API calls that the page might issue (programs list, auth/me)
    // so they return quickly instead of timing out.
    await context.route('**/api/programs', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await context.route('**/api/auth/me', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    });
    await context.route('**/api/stats/online', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"count":0}' });
    });

    for (const path of allPaths) {
      try {
        const html = await prerenderRoute(context, previewOrigin, path);
        await writeRouteHtml(path, html);
        console.error(`[prerender] OK ${path}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[prerender] ✗ ${path}: ${msg}`);
        throw err;
      }
    }

    await writeNotFoundFallback();
    console.error('[prerender] OK /404.html');
    // The /__not_found__ snapshot is only a staging area for the 404 fallback —
    // we don't want it shipped, indexed, or linked, so remove it from dist now.
    await rm(resolve(DIST_DIR, '__not_found__'), { recursive: true, force: true });
  } finally {
    if (browser !== null) await browser.close();
    killPreviewTree(previewServer);
  }
}

await main();
