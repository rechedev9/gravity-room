import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import {
  programCoverLayout,
  type CoverShape,
  type CoverSpec,
  type CoverTone,
  type CoverVariant,
} from '@gzclp/domain/program-cover';
import { colors, fonts } from '@gzclp/design-tokens';

type Props = {
  readonly spec: CoverSpec;
  readonly variant: CoverVariant;
};

const TONE_COLOR: Readonly<Record<CoverTone, string>> = {
  focal: colors.accent,
  shape: colors.ruleStrong,
  quiet: colors.rule,
};

function renderShape(shape: CoverShape, index: number) {
  const stroke = TONE_COLOR[shape.tone];
  if (shape.kind === 'rect') {
    return (
      <Rect
        key={index}
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        fill={stroke}
      />
    );
  }
  if (shape.kind === 'circle') {
    return (
      <Circle
        key={index}
        cx={shape.cx}
        cy={shape.cy}
        r={shape.r}
        stroke={stroke}
        strokeWidth={shape.strokeWidth}
        fill="none"
      />
    );
  }
  return (
    <Line
      key={index}
      x1={shape.x1}
      y1={shape.y1}
      x2={shape.x2}
      y2={shape.y2}
      stroke={stroke}
      strokeWidth={shape.strokeWidth}
    />
  );
}

/**
 * Code-drawn program cover in the Forged Iron language: flat shapes from the
 * design tokens, one accent element, a Bebas monogram. The geometry comes from
 * `programCoverLayout`, shared with the web, so a program looks the same everywhere.
 */
export function ProgramCover({ spec, variant }: Props) {
  const layout = programCoverLayout(spec, variant);
  const { monogram } = layout;

  return (
    <Svg
      accessible={false}
      width="100%"
      height="100%"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="xMidYMid slice"
      pointerEvents="none"
    >
      <Rect x={0} y={0} width={layout.width} height={layout.height} fill={colors.surface2} />
      {layout.shapes.map(renderShape)}
      {layout.ticks.map((tick, index) => (
        <Rect
          key={index}
          x={tick.x}
          y={tick.y}
          width={tick.size}
          height={tick.size}
          fill={colors.accentDim}
        />
      ))}
      {monogram !== null ? (
        <>
          {monogram.plate !== null ? (
            <Rect
              x={monogram.plate.x}
              y={monogram.plate.y}
              width={monogram.plate.width}
              height={monogram.plate.height}
              fill={colors.surface2}
              opacity={0.88}
            />
          ) : null}
          <SvgText
            x={monogram.x}
            y={monogram.y}
            fill={colors.textPrimary}
            fontFamily={fonts.display}
            fontSize={monogram.fontSize}
            letterSpacing={monogram.letterSpacing}
          >
            {monogram.text}
          </SvgText>
          <Rect
            x={monogram.rule.x}
            y={monogram.rule.y}
            width={monogram.rule.width}
            height={monogram.rule.height}
            fill={colors.accent}
          />
        </>
      ) : null}
    </Svg>
  );
}
