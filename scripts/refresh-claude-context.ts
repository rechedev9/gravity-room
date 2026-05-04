#!/usr/bin/env bun
/**
 * Refreshes the AUTO:* sections of CLAUDE.md with the live API surface
 * (from the running ElysiaJS swagger spec) and the live DB schema (from
 * the Drizzle table definitions).
 *
 * Usage:
 *   bun run dev:api          # in another terminal — required
 *   bun run context:refresh  # this script
 *
 * The script edits only the regions between sentinel comments
 * (<!-- AUTO:API-START --> ... <!-- AUTO:API-END --> and the DB pair).
 * Hand-written sections of CLAUDE.md are left untouched.
 */
import { $ } from 'bun';
import { resolve } from 'path';

const SWAGGER_URL = process.env['API_SPEC_URL'] ?? 'http://localhost:3001/swagger/json';
const REPO_ROOT = resolve(import.meta.dir, '..');
const CLAUDE_MD = resolve(REPO_ROOT, 'CLAUDE.md');

type ColInfo = {
  name: string;
  type: string;
  notNull: boolean;
  primary: boolean;
  unique: boolean;
};

type TableInfo = {
  exportName: string;
  tableName: string;
  columns: ColInfo[];
};

type OpenAPIOperation = {
  tags?: string[];
  summary?: string;
};

type OpenAPISpec = {
  paths?: Record<string, Record<string, OpenAPIOperation>>;
};

async function main() {
  const apiSection = await fetchAndFormatApi();
  const dbSection = await dumpAndFormatDb();

  let md = await Bun.file(CLAUDE_MD).text();
  md = splice(md, 'AUTO:API', apiSection);
  md = splice(md, 'AUTO:DB', dbSection);
  await Bun.write(CLAUDE_MD, md);

  // Keep the file prettier-clean so the lefthook format check doesn't
  // bounce it after every refresh.
  await $`bunx prettier --write ${CLAUDE_MD}`.cwd(REPO_ROOT).quiet();

  process.stdout.write(`Updated ${CLAUDE_MD}\n`);
}

async function fetchAndFormatApi(): Promise<string> {
  let res: Response;
  try {
    res = await fetch(SWAGGER_URL);
  } catch {
    process.stderr.write(
      `Could not reach ${SWAGGER_URL} — is the API running? Try: bun run dev:api\n`
    );
    process.exit(1);
  }
  if (!res.ok) {
    process.stderr.write(`Failed to fetch ${SWAGGER_URL} (${res.status}).\n`);
    process.exit(1);
  }
  const spec = (await res.json()) as OpenAPISpec;
  return formatApiSection(spec);
}

async function dumpAndFormatDb(): Promise<string> {
  const result = await $`bun apps/backend/api/scripts/dump-schema.ts`.cwd(REPO_ROOT).quiet();
  const tables = JSON.parse(result.stdout.toString()) as TableInfo[];
  return formatDbSection(tables);
}

function formatDbSection(tables: TableInfo[]): string {
  const out: string[] = [
    `_${tables.length} tables. Source: \`apps/backend/api/src/db/schema.ts\`._`,
    '',
  ];
  for (const t of tables) {
    out.push(`### \`${t.tableName}\``);
    const cols = t.columns.map((c) => {
      const tags: string[] = [c.type];
      if (c.primary) tags.push('PK');
      if (c.unique) tags.push('unique');
      if (c.notNull && !c.primary) tags.push('NOT NULL');
      return `\`${c.name}\` *(${tags.join(', ')})*`;
    });
    out.push(cols.join(' · '));
    out.push('');
  }
  return out.join('\n').trimEnd();
}

function formatApiSection(spec: OpenAPISpec): string {
  const paths = spec.paths ?? {};
  const groups = new Map<string, string[]>();
  let total = 0;

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      total++;
      const tag = op.tags?.[0] ?? 'Other';
      const summary = op.summary ?? '';
      const line = `- \`${method.toUpperCase()} ${path}\`${summary ? ` — ${summary}` : ''}`;
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag)!.push(line);
    }
  }

  const out: string[] = [
    `_${total} endpoints across ${groups.size} tags. Source: ${SWAGGER_URL}._`,
    '',
  ];
  for (const [tag, lines] of [...groups.entries()].sort()) {
    out.push(`### ${tag}`);
    out.push(...lines);
    out.push('');
  }
  return out.join('\n').trimEnd();
}

function splice(md: string, marker: string, content: string): string {
  const start = `<!-- ${marker}-START -->`;
  const end = `<!-- ${marker}-END -->`;
  const re = new RegExp(`${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`);
  if (!re.test(md)) {
    process.stderr.write(`Sentinel pair not found in CLAUDE.md: ${start} / ${end}\n`);
    process.exit(1);
  }
  return md.replace(re, `${start}\n${content}\n${end}`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

await main();
