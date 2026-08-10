/**
 * Generate public/llms.txt from the live catalog + wiki registry so the
 * GEO surface never drifts from the product. Prose sections stay curated;
 * program/exercise link lists are derived.
 */
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXERCISE_ARTICLES } from '../src/features/exercise-wiki/content/registry';
import { SITE_ORIGIN, activeProgramLinks } from './seo-config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '../public');

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const programs = activeProgramLinks();
  const programLines = programs
    .map((p) => `- **${p.name}** — ${SITE_ORIGIN}/programs/${p.id}`)
    .join('\n');

  const wikiEn = EXERCISE_ARTICLES.map(
    (a) => `- **${a.content.en.title}** — ${SITE_ORIGIN}/en/exercises/${a.slug.en}`
  ).join('\n');
  const wikiEs = EXERCISE_ARTICLES.map(
    (a) => `- **${a.content.es.title}** — ${SITE_ORIGIN}/ejercicios/${a.slug.es}`
  ).join('\n');

  const body = `# Gravity Room

> Free web app for structured weightlifting with automatic progression. No spreadsheets, no guessing.

Canonical URL: ${SITE_ORIGIN}/llms.txt
Last updated: ${today()}

## What it does

Gravity Room tracks weightlifting programs and automates progression. When you complete all prescribed reps, the app increases the weight for next session. When you fail, the program adapts — adjusting the set/rep scheme before deloading — so you keep making progress longer.

## Key Features

- **Automatic progression**: weight adjusts based on your performance, not arbitrary schedules
- **Multiple programs**: ${programs.map((p) => p.name).join(', ')}
- **Strength statistics**: see your estimated 1RM curve and volume over time
- **Cloud sync**: signed-in users can sync data across devices
- **100% free**: no premium tier, no ads, no feature gates
- **PWA**: works offline and installable on mobile

## How It Works

1. **Choose a program** — pick from the catalog and set starting weights
2. **Follow the plan** — the app tells you exactly what to lift each session
3. **Progress automatically** — complete your reps and the weight goes up; fail and the program adapts

## Programs Available

${programLines}

## GZCLP vs StrongLifts 5x5

| | GZCLP | StrongLifts 5x5 |
|---|---|---|
| Structure | 3-tier (T1/T2/T3), different rep schemes per tier | A/B alternating, 5x5 |
| Failure handling | Staged: 5x3 → 6x2 → deload at 85% | Reset weight by 10% after 3 fails |
| Exercises/session | 4–5 | 2–3 |
| Beginner-friendliness | Slightly more complex, better long-term | Simpler to start |

Comparison guide: ${SITE_ORIGIN}/en/programs/gzclp-vs-stronglifts

## Why Automatic Progression Matters

Structured programs with built-in progression rules produce consistent strength gains because they apply progressive overload systematically. Gravity Room eliminates the mental overhead of managing this manually.

Guide: ${SITE_ORIGIN}/en/programs/automatic-progression

## Evidence-based exercise guides

${wikiEn}
${wikiEs}

Each guide identifies its editorial responsibility, technical reviewer, review date, methodology, and primary references. The guides are general educational material, not individualized medical advice.

## Technical Architecture

- **Frontend**: React 19, Vite, TanStack Router, TanStack Query, Tailwind v4, TypeScript strict
- **Backend**: ElysiaJS serverless API on Vercel with Drizzle ORM
- **Data**: Neon PostgreSQL and Upstash Redis REST
- **Analytics**: TypeScript insight pipelines in the API, computed by a protected Vercel Cron job
- **Auth**: rotating JWT sessions; email/password and configurable Google, Apple, GitHub, and Microsoft sign-in
- **Source**: https://github.com/rechedev9/gravity-room

## Links

- Home (English): ${SITE_ORIGIN}/en
- Home (Spanish): ${SITE_ORIGIN}/
- Privacy Policy: ${SITE_ORIGIN}/privacy
- Exercise guides (English): ${SITE_ORIGIN}/en/exercises
- Guías de ejercicios (español): ${SITE_ORIGIN}/ejercicios
- Extended LLM context: ${SITE_ORIGIN}/llms-full.txt
- GitHub: https://github.com/rechedev9/gravity-room
- Community: https://discord.gg/FXNBrgYf7U

---

## Gravity Room (en español)

> App web gratuita para programas de entrenamiento con progresión automática.

### Características

- Progresión automática de peso según rendimiento
- Múltiples programas: ${programs.map((p) => p.name).join(', ')}
- Estadísticas: curva de 1RM estimado y volumen en el tiempo
- Sincronización en la nube para usuarios registrados
- 100% gratis, sin anuncios ni nivel premium
- PWA — funciona offline y se puede instalar en móvil

### Cómo funciona

1. Elige tu programa y configura tus pesos iniciales
2. La app te dice exactamente qué hacer en cada sesión
3. Completa tus reps y el peso sube; falla y el programa se adapta

### Por qué la progresión automática importa

Los programas estructurados permiten aplicar la sobrecarga progresiva de forma consistente y registrar cómo responde cada usuario. Los resultados dependen del entrenamiento, la recuperación y las circunstancias individuales.
`;

  await writeFile(resolve(PUBLIC_DIR, 'llms.txt'), body, 'utf8');
  console.error(
    `[llms] wrote llms.txt (${programs.length} programs, ${EXERCISE_ARTICLES.length} wiki articles)`
  );
}

await main();
