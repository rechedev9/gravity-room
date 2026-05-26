// Assembles a fully self-contained dist/ for serving at /presentacion/.
// No bundler: asset paths are relative and <base href="/presentacion/"> in
// index.html handles subpath serving. Uses node:fs (works under node or bun).
import { rm, mkdir, cp } from 'node:fs/promises';

const here = (p) => new URL(`./${p}`, import.meta.url);

await rm(here('dist'), { recursive: true, force: true });
await mkdir(here('dist'), { recursive: true });

for (const entry of ['index.html', 'css', 'js', 'reveal', 'assets']) {
  await cp(here(entry), here(`dist/${entry}`), { recursive: true });
}

console.log('dist/ built — contents:');
console.log(['index.html', 'css/', 'reveal/', 'assets/'].join('  '));
