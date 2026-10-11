/**
 * Write src/styles/tokens.css from @gzclp/design-tokens. Run it after changing a token;
 * tokens-css.test.ts fails while the committed file is out of sync.
 */
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTokensCss } from '@gzclp/design-tokens/css';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, '../src/styles/tokens.css');

await writeFile(OUTPUT, renderTokensCss(), 'utf8');
process.stdout.write(`wrote ${OUTPUT}
`);
