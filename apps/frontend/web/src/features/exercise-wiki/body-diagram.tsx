// body-diagram.tsx
import type { CSSProperties, ReactNode } from 'react';
import type { ArticleLang } from '@gzclp/domain/schemas/exercise-article';
import {
  anteriorData,
  posteriorData,
  BODY_VIEWBOX,
  type BodyView,
  type MuscleRegion,
  type RegionPolygons,
} from './body-diagram-data';

/**
 * Themed anterior/posterior muscle diagrams for the exercise wiki.
 *
 * Forged Iron: the silhouette is a faint rule-colored figure on the ink
 * background; primary muscles glow in the scarce gold accent, secondary muscles
 * in the dimmer accent. Pure inline SVG - no external dep, no interactivity, no
 * tooltips. Unknown muscle names are silently ignored so future articles can
 * never crash the diagram.
 */

// Anatomical muscle names used in the article content files (primaryMuscles /
// secondaryMuscles) mapped down to the vendored library's region keys. A name
// may resolve to a region that only exists in one view - the diagram simply
// highlights it wherever that region is drawn.
//
// Visual-approximation calls worth flagging:
//   serratus anterior -> obliques   (no dedicated serratus region)
//   latissimus dorsi  -> upper-back (the lat sweep lives in the upper-back polys)
//   core stabilizers  -> abs        (bracing musculature; abs is the closest region)
export const MUSCLE_NAME_TO_REGION: Readonly<Record<string, MuscleRegion>> = {
  'pectoralis major': 'chest',
  'triceps brachii': 'triceps',
  'anterior deltoid': 'front-deltoids',
  'serratus anterior': 'obliques',
  'erector spinae': 'lower-back',
  'gluteus maximus': 'gluteal',
  hamstrings: 'hamstring',
  quadriceps: 'quadriceps',
  trapezius: 'trapezius',
  'latissimus dorsi': 'upper-back',
  adductors: 'adductor',
  gastrocnemius: 'calves',
  'core stabilizers': 'abs',
};

// Muscles present in the content that are consciously NOT drawn: deep muscles
// with no faithful surface region in the model. Listed explicitly so the guard
// test can assert every content muscle is either mapped or intentionally omitted.
export const OMITTED_MUSCLES: readonly string[] = ['coracobrachialis'];

type Highlight = 'primary' | 'secondary' | 'base';

function toRegionSet(names: readonly string[]): ReadonlySet<MuscleRegion> {
  const out = new Set<MuscleRegion>();
  for (const name of names) {
    const region = MUSCLE_NAME_TO_REGION[name];
    if (region !== undefined) out.add(region);
  }
  return out;
}

const REGION_FILL: Record<Highlight, string> = {
  // The faint silhouette: a low-contrast rule tone that reads as a quiet outline
  // on the ink/card background, never as a loud shape.
  base: 'var(--color-rule)',
  primary: 'var(--color-accent)',
  secondary: 'var(--color-accent-dim)',
};

function BodySvg({
  data,
  primaryRegions,
  secondaryRegions,
  title,
  className,
}: {
  readonly data: readonly RegionPolygons[];
  readonly primaryRegions: ReadonlySet<MuscleRegion>;
  readonly secondaryRegions: ReadonlySet<MuscleRegion>;
  readonly title: string;
  readonly className?: string;
}): ReactNode {
  return (
    <svg
      viewBox={BODY_VIEWBOX}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ height: 'auto' }}
    >
      <title>{title}</title>
      {data.map((region) => {
        const highlight: Highlight = primaryRegions.has(region.muscle)
          ? 'primary'
          : secondaryRegions.has(region.muscle)
            ? 'secondary'
            : 'base';
        const fill = REGION_FILL[highlight];
        return region.svgPoints.map((points, i) => (
          <polygon
            key={`${region.muscle}-${i}`}
            points={points.trim()}
            style={{ fill, transition: 'fill 0.2s ease' }}
          />
        ));
      })}
    </svg>
  );
}

const VIEW_LABEL = {
  es: { anterior: 'Vista anterior', posterior: 'Vista posterior' },
  en: { anterior: 'Anterior view', posterior: 'Posterior view' },
} as const;

const LEGEND_LABEL = {
  es: { primary: 'Primarios', secondary: 'Secundarios' },
  en: { primary: 'Primary', secondary: 'Secondary' },
} as const;

function Legend({ lang }: { readonly lang: ArticleLang }): ReactNode {
  const l = LEGEND_LABEL[lang];
  const dot = (color: string): CSSProperties => ({
    display: 'inline-block',
    width: '0.6rem',
    height: '0.6rem',
    borderRadius: '9999px',
    background: color,
  });
  return (
    <div className="mt-4 flex items-center justify-center gap-5 font-mono text-[11px] uppercase tracking-[0.14em] text-label select-none">
      <span className="flex items-center gap-2">
        <span aria-hidden="true" style={dot('var(--color-accent)')} />
        {l.primary}
      </span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" style={dot('var(--color-accent-dim)')} />
        {l.secondary}
      </span>
    </div>
  );
}

/**
 * Pick the view that best represents an exercise's PRIMARY muscles - the one
 * whose regions cover more of them. Ties resolve to anterior (the conventional
 * front-facing default). Deadlift -> posterior, bench + squat -> anterior.
 */
export function pickBestView(primary: readonly string[]): BodyView {
  const regions = toRegionSet(primary);
  const anteriorKeys = new Set(anteriorData.map((r) => r.muscle));
  const posteriorKeys = new Set(posteriorData.map((r) => r.muscle));
  let anteriorCount = 0;
  let posteriorCount = 0;
  for (const region of regions) {
    if (anteriorKeys.has(region)) anteriorCount += 1;
    if (posteriorKeys.has(region)) posteriorCount += 1;
  }
  return posteriorCount > anteriorCount ? 'posterior' : 'anterior';
}

const DATA_BY_VIEW: Record<BodyView, readonly RegionPolygons[]> = {
  anterior: anteriorData,
  posterior: posteriorData,
};

export interface BodyDiagramProps {
  readonly primary: readonly string[];
  readonly secondary: readonly string[];
  readonly lang: ArticleLang;
  /** 'both' renders anterior + posterior side by side (article view). */
  readonly view?: BodyView | 'both';
  /** 'card' is the compact single-figure variant for index cards. */
  readonly variant?: 'full' | 'card';
  readonly showLegend?: boolean;
  readonly className?: string;
}

export function BodyDiagram({
  primary,
  secondary,
  lang,
  view = 'both',
  variant = 'full',
  showLegend = false,
  className,
}: BodyDiagramProps): ReactNode {
  const primaryRegions = toRegionSet(primary);
  const secondaryRegions = toRegionSet(secondary);
  const views: BodyView[] = view === 'both' ? ['anterior', 'posterior'] : [view];

  if (variant === 'card') {
    // Compact single figure for the wiki index cards - no labels, no legend.
    const only = views[0];
    return (
      <BodySvg
        data={DATA_BY_VIEW[only]}
        primaryRegions={primaryRegions}
        secondaryRegions={secondaryRegions}
        title={VIEW_LABEL[lang][only]}
        className={className}
      />
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-center sm:gap-12">
        {views.map((v) => (
          <figure key={v} className="flex flex-col items-center">
            <BodySvg
              data={DATA_BY_VIEW[v]}
              primaryRegions={primaryRegions}
              secondaryRegions={secondaryRegions}
              title={VIEW_LABEL[lang][v]}
              className="w-40 max-w-full sm:w-44"
            />
            <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-label select-none">
              {VIEW_LABEL[lang][v]}
            </figcaption>
          </figure>
        ))}
      </div>
      {showLegend && <Legend lang={lang} />}
    </div>
  );
}
