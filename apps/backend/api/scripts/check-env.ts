#!/usr/bin/env -S npx tsx
// CLI wrapper around validateEnv for runtime gating and CI sync checks.
//
// Usage:
//   tsx apps/backend/api/scripts/check-env.ts
//     Validates the current process.env, defaulting NODE_ENV to 'production'.
//
//   tsx apps/backend/api/scripts/check-env.ts --env-file <path>
//     Parses <path> as KEY=VALUE pairs and validates those instead.
//
//   tsx apps/backend/api/scripts/check-env.ts --node-env <env>
//     Override NODE_ENV (e.g. 'development' to no-op). Default 'production'.
//
// Exit codes:
//   0 — env is valid (or NODE_ENV is not production).
//   1 — required vars missing or constraints violated. Detailed error on stderr.

import { readFileSync } from 'node:fs';
import { formatValidationError, validateEnv } from '../src/lib/env-validation';

type Args = {
  envFile?: string;
  nodeEnv: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { nodeEnv: 'production' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--env-file') {
      const next = argv[i + 1];
      if (!next) {
        console.error('error: --env-file requires a path argument');
        process.exit(2);
      }
      args.envFile = next;
      i++;
    } else if (arg === '--node-env') {
      const next = argv[i + 1];
      if (!next) {
        console.error('error: --node-env requires a value');
        process.exit(2);
      }
      args.nodeEnv = next;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        'Usage: check-env.ts [--env-file <path>] [--node-env <env>]\n' +
          '\n' +
          'Validates env against REQUIRED_ENV. Default NODE_ENV is "production".\n'
      );
      process.exit(0);
    } else if (arg !== undefined) {
      console.error(`error: unknown argument "${arg}"`);
      process.exit(2);
    }
  }
  return args;
}

// Minimal KEY=VALUE parser. Supports # comments, blank lines, optional surrounding
// quotes on the value. Does NOT support multi-line values or shell expansion —
// matching how docker --env-file behaves.
function parseEnvFile(path: string): Record<string, string> {
  const text = readFileSync(path, 'utf-8');
  const env: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip inline comment after an unquoted value: VAR=foo # comment
    if (!/^["']/.test(value)) {
      const hashIdx = value.indexOf(' #');
      if (hashIdx !== -1) value = value.slice(0, hashIdx).trim();
    }
    // Strip surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) env[key] = value;
  }
  return env;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const env: Record<string, string | undefined> = args.envFile
    ? parseEnvFile(args.envFile)
    : process.env;

  const result = validateEnv(env, args.nodeEnv);
  if (result.ok) {
    const source = args.envFile ?? 'process.env';
    process.stdout.write(`env-validation: ok (NODE_ENV=${args.nodeEnv}, source=${source})\n`);
    process.exit(0);
  }

  console.error(formatValidationError(result));
  process.exit(1);
}

main();
