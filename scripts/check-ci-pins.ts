import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflowsDir = '.github/workflows';
const workflowPaths = readdirSync(workflowsDir)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map((name) => join(workflowsDir, name));
const failures: string[] = [];

for (const path of workflowPaths) {
  const source = readFileSync(path, 'utf8');

  for (const match of source.matchAll(/\buses:\s*[^@\s]+@([^\s#]+)/g)) {
    const ref = match[1] ?? '';
    if (!/^[a-f0-9]{40}$/.test(ref)) {
      failures.push(`${path}: action ref is not a full commit SHA: ${match[0]}`);
    }
  }

  for (const match of source.matchAll(/^\s*image:\s*([^\s#]+)/gm)) {
    const image = match[1] ?? '';
    if (!/@sha256:[a-f0-9]{64}$/.test(image)) {
      failures.push(`${path}: service image is not digest-pinned: ${image}`);
    }
  }

  for (const match of source.matchAll(
    /\b((?:ghcr\.io|docker\.io)\/[A-Za-z0-9._/-]+(?::[A-Za-z0-9._-]+)?(?:@sha256:[a-f0-9]{64})?)/g
  )) {
    const image = match[1] ?? '';
    if (!/@sha256:[a-f0-9]{64}$/.test(image)) {
      failures.push(`${path}: container reference is not digest-pinned: ${image}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`CI pin check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`CI pins OK: ${workflowPaths.length} workflows`);
