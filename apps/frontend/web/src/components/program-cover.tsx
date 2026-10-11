import { useMemo, type CSSProperties, type ReactNode } from 'react';
import {
  programCoverLayout,
  programCoverSpec,
  type CoverInput,
  type CoverShape,
  type CoverTone,
  type CoverVariant,
} from '@gzclp/domain/program-cover';
import { cn } from '@/lib/cn';

interface ProgramCoverProps extends CoverInput {
  readonly variant?: CoverVariant;
  readonly className?: string;
}

// The same tone-to-token mapping as the mobile cover. The variables carry the dark palette
// from @gzclp/design-tokens, so dark renders identically and the light theme restyles it.
const TONE_FILL: Readonly<Record<CoverTone, string>> = {
  focal: 'var(--color-accent)',
  shape: 'var(--color-rule-light)',
  quiet: 'var(--color-rule)',
};

const ASPECT_CLASS: Readonly<Record<CoverVariant, string>> = {
  cover: 'aspect-[180/72]',
  thumbnail: 'aspect-[72/64]',
};

function renderShape(shape: CoverShape, index: number): ReactNode {
  const color = TONE_FILL[shape.tone];
  if (shape.kind === 'rect') {
    return (
      <rect
        key={index}
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        style={{ fill: color }}
      />
    );
  }
  if (shape.kind === 'circle') {
    return (
      <circle
        key={index}
        cx={shape.cx}
        cy={shape.cy}
        r={shape.r}
        strokeWidth={shape.strokeWidth}
        style={{ fill: 'none', stroke: color }}
      />
    );
  }
  return (
    <line
      key={index}
      x1={shape.x1}
      y1={shape.y1}
      x2={shape.x2}
      y2={shape.y2}
      strokeWidth={shape.strokeWidth}
      style={{ stroke: color }}
    />
  );
}

const MONOGRAM_STYLE: CSSProperties = {
  fill: 'var(--color-main)',
  fontFamily: "'Bebas Neue', 'Barlow', sans-serif",
};

/**
 * Code-drawn program cover, the web twin of the mobile ProgramCover. The geometry comes from
 * `programCoverLayout` in @gzclp/domain, so a program has the same cover in both apps. It
 * fills its parent's width and keeps the cover's aspect ratio.
 */
export function ProgramCover({
  variant = 'cover',
  className,
  programId,
  title,
  category,
  level,
  workoutsPerWeek,
}: ProgramCoverProps): ReactNode {
  const layout = useMemo(
    () =>
      programCoverLayout(
        programCoverSpec({ programId, title, category, level, workoutsPerWeek }),
        variant
      ),
    [programId, title, category, level, workoutsPerWeek, variant]
  );
  const { monogram } = layout;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="xMidYMid slice"
      data-testid="program-cover"
      data-variant={variant}
      className={cn('block w-full', ASPECT_CLASS[variant], className)}
    >
      <rect
        x={0}
        y={0}
        width={layout.width}
        height={layout.height}
        style={{ fill: 'var(--color-surface-2)' }}
      />
      {layout.shapes.map(renderShape)}
      {layout.ticks.map((tick, index) => (
        <rect
          key={index}
          x={tick.x}
          y={tick.y}
          width={tick.size}
          height={tick.size}
          style={{ fill: 'var(--color-accent-dim)' }}
        />
      ))}
      {monogram !== null ? (
        <>
          {monogram.plate !== null ? (
            <rect
              x={monogram.plate.x}
              y={monogram.plate.y}
              width={monogram.plate.width}
              height={monogram.plate.height}
              opacity={0.88}
              style={{ fill: 'var(--color-surface-2)' }}
            />
          ) : null}
          <text
            x={monogram.x}
            y={monogram.y}
            fontSize={monogram.fontSize}
            letterSpacing={monogram.letterSpacing}
            style={MONOGRAM_STYLE}
          >
            {monogram.text}
          </text>
          <rect
            x={monogram.rule.x}
            y={monogram.rule.y}
            width={monogram.rule.width}
            height={monogram.rule.height}
            style={{ fill: 'var(--color-accent)' }}
          />
        </>
      ) : null}
    </svg>
  );
}
