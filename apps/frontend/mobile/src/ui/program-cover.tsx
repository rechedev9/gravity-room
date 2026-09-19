import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import type { CoverSpec } from '../lib/programs/program-cover-spec';
import { colors, fonts } from '../shell/design';

export type CoverVariant = 'cover' | 'thumbnail';

type Props = {
  readonly spec: CoverSpec;
  readonly variant: CoverVariant;
};

/** Logical canvases; the SVG scales to fill its parent at these ratios. */
const CANVAS: Readonly<Record<CoverVariant, { readonly width: number; readonly height: number }>> =
  {
    cover: { width: 180, height: 100 },
    thumbnail: { width: 72, height: 64 },
  };

/**
 * Code-drawn program cover in the Forged Iron language: flat shapes from the
 * design tokens, one accent element, a Bebas monogram. All geometry derives
 * from `spec`, so a program always looks the same.
 */
export function ProgramCover({ spec, variant }: Props) {
  const { width, height } = CANVAS[variant];
  const compact = variant === 'thumbnail';
  const pad = compact ? 6 : 10;
  const monogramSize = compact ? 20 : Math.round(height * 0.36);
  const monogramWidth = spec.monogram.length * monogramSize * 0.42;
  // Cover: shapes live right of the monogram column, above the tick row.
  // Thumbnail: too small to split, so the motif fills the canvas, the monogram
  // overlays it and the weekly ticks are dropped.
  const showTicks = spec.ticks > 0 && !compact;
  const regionLeft = compact || spec.monogram === '' ? pad : pad + monogramWidth + pad;
  const tickRow = showTicks ? 9 : 0;
  const region = {
    left: regionLeft,
    top: pad,
    width: Math.max(0, width - regionLeft - pad),
    height: height - pad * 2 - tickRow,
  };
  const focalColor = colors.accent;
  const shapeColor = colors.ruleStrong;
  const quietColor = colors.rule;

  return (
    <Svg
      accessible={false}
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      pointerEvents="none"
    >
      <Rect x={0} y={0} width={width} height={height} fill={colors.surface2} />
      {spec.motif === 'bars' ? renderBars() : null}
      {spec.motif === 'columns' ? renderColumns() : null}
      {spec.motif === 'arcs' ? renderArcs() : null}
      {spec.motif === 'hatch' ? renderHatch() : null}
      {showTicks ? renderTicks() : null}
      {spec.monogram !== '' ? (
        <>
          {compact ? (
            <Rect
              x={pad - 2}
              y={height - pad - 3 - monogramSize * 0.78}
              width={Math.min(monogramWidth + 4, width - pad * 2 + 4)}
              height={monogramSize * 0.78 + 5}
              fill={colors.surface2}
              opacity={0.88}
            />
          ) : null}
          <SvgText
            x={pad}
            y={height - pad - (compact ? 3 : 6)}
            fill={colors.textPrimary}
            fontFamily={fonts.display}
            fontSize={monogramSize}
            letterSpacing={compact ? 0 : 1}
          >
            {spec.monogram}
          </SvgText>
          <Rect
            x={pad}
            y={height - pad - (compact ? 2 : 3)}
            width={Math.min(monogramWidth, width - pad * 2)}
            height={compact ? 2 : 3}
            fill={colors.accent}
          />
        </>
      ) : null}
    </Svg>
  );

  function renderBars() {
    const gap = compact ? 3 : 5;
    const thickness = Math.max(3, (region.height - gap * (spec.density - 1)) / spec.density);
    return spec.rhythm.map((value, index) => {
      const barWidth = region.width * (0.35 + 0.6 * value);
      return (
        <Rect
          key={index}
          x={region.left + region.width - barWidth}
          y={region.top + index * (thickness + gap)}
          width={barWidth}
          height={thickness}
          fill={index === spec.focal ? focalColor : index % 2 === 0 ? shapeColor : quietColor}
        />
      );
    });
  }

  function renderColumns() {
    const gap = compact ? 3 : 5;
    const columnWidth = Math.max(3, (region.width - gap * (spec.density - 1)) / spec.density);
    return spec.rhythm.map((value, index) => {
      const columnHeight = region.height * (0.3 + 0.65 * value);
      return (
        <Rect
          key={index}
          x={region.left + index * (columnWidth + gap)}
          y={region.top + region.height - columnHeight}
          width={columnWidth}
          height={columnHeight}
          fill={index === spec.focal ? focalColor : index % 2 === 0 ? shapeColor : quietColor}
        />
      );
    });
  }

  function renderArcs() {
    const cx = width - pad;
    const cy = pad;
    const maxRadius = Math.min(region.width, region.height) * 1.05;
    const step = maxRadius / spec.density;
    const strokeWidth = Math.max(2, step * 0.45);
    return spec.rhythm.map((value, index) => (
      <Circle
        key={index}
        cx={cx}
        cy={cy}
        r={step * (index + 0.6) + value * step * 0.3}
        stroke={index === spec.focal ? focalColor : index % 2 === 0 ? shapeColor : quietColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
    ));
  }

  function renderHatch() {
    const count = spec.density * 2;
    const step = (region.width + region.height) / (count + 1);
    const strokeWidth = compact ? 2 : 3;
    return Array.from({ length: count }, (_, index) => {
      const jitter = spec.rhythm[index % spec.density] ?? 0.5;
      const offset = step * (index + 1) + (jitter - 0.5) * step * 0.6;
      // Diagonal from the region's top edge to its right edge (or left/bottom).
      const x1 = region.left + Math.min(offset, region.width);
      const y1 = region.top + Math.max(0, offset - region.width);
      const x2 = region.left + Math.max(0, offset - region.height);
      const y2 = region.top + Math.min(offset, region.height);
      return (
        <Line
          key={index}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={index === spec.focal ? focalColor : index % 2 === 0 ? shapeColor : quietColor}
          strokeWidth={strokeWidth}
        />
      );
    });
  }

  function renderTicks() {
    const size = compact ? 3 : 4;
    const gap = compact ? 2 : 3;
    const total = spec.ticks * size + (spec.ticks - 1) * gap;
    const startX = width - pad - total;
    const y = height - pad - size;
    return Array.from({ length: spec.ticks }, (_, index) => (
      <Rect
        key={index}
        x={startX + index * (size + gap)}
        y={y}
        width={size}
        height={size}
        fill={colors.accentDim}
      />
    ));
  }
}
