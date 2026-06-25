import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  type DotProps,
} from 'recharts';
import type { ChartDataPoint } from '@gzclp/domain/types';
import { getChartTheme, formatChartDate } from './chart-theme';

const MAX_LABELS = 6;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChartPoint {
  readonly idx: number;
  readonly x: string;
  readonly weight: number;
  /** Logged sessions: the real, solid-gold series. `null` once the projection begins. */
  readonly realWeight: number | null;
  /** Planned projection: the dashed/dimmed series. `null` for the logged segment. */
  readonly projWeight: number | null;
  readonly result: 'success' | 'fail' | null;
  readonly isPr: boolean;
  readonly isCurrentPr: boolean;
  readonly stage: number;
  readonly date?: string;
  readonly amrapReps?: number;
  readonly isProjected: boolean;
}

interface LineChartProps {
  readonly data: ChartDataPoint[];
  readonly label: string;
  readonly resultTimestamps?: Readonly<Record<string, string>>;
  readonly mode?: 'weight' | 'numeric';
  readonly yAxisLabel?: string;
  readonly showAllPrs?: boolean;
}

function buildLabel(
  point: ChartDataPoint,
  _idx: number,
  resultTimestamps?: Readonly<Record<string, string>>
): string {
  if (point.date) {
    const f = formatChartDate(point.date);
    if (f) return f;
  }
  if (resultTimestamps) {
    const ts = resultTimestamps[String(point.workout - 1)];
    if (ts) {
      const f = formatChartDate(ts);
      if (f) return f;
    }
  }
  return `#${point.workout}`;
}

// ---------------------------------------------------------------------------
// Custom dot renderers
// ---------------------------------------------------------------------------

/** Diamond (rotated square) PR marker — the Forged Iron data accent. */
function diamondPath(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`;
}

function CustomDot(props: DotProps & { payload?: ChartPoint }): React.ReactElement | null {
  const { cx, cy, payload } = props;
  if (!payload || cx === undefined || cy === undefined) return null;

  const theme = getChartTheme();

  if (payload.isProjected) return null;

  if (payload.isCurrentPr) {
    return (
      <g key={`pr-cur-${payload.idx}`}>
        <path d={diamondPath(cx, cy, 9)} fill={theme.pr} opacity={0.22} />
        <path d={diamondPath(cx, cy, 6)} fill={theme.pr} stroke={theme.bg} strokeWidth={1.5} />
      </g>
    );
  }

  if (payload.isPr) {
    return (
      <path
        key={`pr-${payload.idx}`}
        d={diamondPath(cx, cy, 5)}
        fill={theme.pr}
        stroke={theme.bg}
        strokeWidth={1}
      />
    );
  }

  if (payload.result === 'success') {
    return <circle key={`ok-${payload.idx}`} cx={cx} cy={cy} r={3.5} fill={theme.ok} />;
  }

  if (payload.result === 'fail') {
    const a = 3;
    return (
      <g key={`fail-${payload.idx}`}>
        <line
          x1={cx - a}
          y1={cy - a}
          x2={cx + a}
          y2={cy + a}
          stroke={theme.fail}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={cx + a}
          y1={cy - a}
          x2={cx - a}
          y2={cy + a}
          stroke={theme.fail}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface CustomTooltipProps {
  readonly active?: boolean;
  readonly payload?: Array<{ payload: ChartPoint }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps): React.ReactElement | null {
  const { t } = useTranslation();

  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  if (!pt || pt.result === null) return null;

  const resultLabel = pt.result === 'success' ? t('chart.result_success') : t('chart.result_fail');
  const dateLabel = pt.date ? formatChartDate(pt.date) : null;

  return (
    <div
      className="rounded border px-2 py-1.5 text-xs shadow-lg whitespace-nowrap"
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-rule)',
        color: 'var(--color-tooltip-text)',
      }}
    >
      <div className="font-bold">
        {pt.weight} kg{pt.isPr && <span className="ml-1 text-[var(--color-chart-pr)]"> PR</span>}
      </div>
      {dateLabel && <div className="text-[var(--color-muted)]">{dateLabel}</div>}
      <div>{resultLabel}</div>
      {pt.amrapReps !== undefined && pt.amrapReps > 0 && <div>{pt.amrapReps} reps AMRAP</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LineChart({
  data,
  label,
  resultTimestamps,
  mode = 'weight',
  yAxisLabel,
  showAllPrs,
}: LineChartProps): React.ReactNode {
  const { t } = useTranslation();
  const theme = getChartTheme();
  const effectiveShowPrs = showAllPrs ?? mode === 'weight';

  // Find last marked index
  const lastMarkedIdx = useMemo(() => {
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].result !== null) return i;
    }
    return -1;
  }, [data]);

  // Compute PR indices
  const prInfo = useMemo(() => {
    if (!effectiveShowPrs) return { prSet: new Set<number>(), currentMaxIdx: -1 };
    let runningMax = -Infinity;
    let currentMaxIdx = -1;
    const prSet = new Set<number>();
    for (let i = 0; i <= lastMarkedIdx; i++) {
      if (data[i].result === 'success' && data[i].weight > runningMax) {
        runningMax = data[i].weight;
        currentMaxIdx = i;
        prSet.add(i);
      }
    }
    return { prSet, currentMaxIdx };
  }, [data, lastMarkedIdx, effectiveShowPrs]);

  // Stage change indices (for reference lines)
  const stageChanges = useMemo(() => {
    if (mode === 'numeric') return [];
    const changes: number[] = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i].stage !== data[i - 1].stage) changes.push(i);
    }
    return changes;
  }, [data, mode]);

  // Deload bands
  const deloadBands = useMemo(() => {
    if (mode === 'numeric') return [];
    const bands: Array<{ x1: string; x2: string }> = [];
    for (let i = 1; i <= lastMarkedIdx; i++) {
      if (data[i].weight < data[i - 1].weight && data[i].stage < data[i - 1].stage) {
        const prev = i > 0 ? buildLabel(data[i - 1], i - 1, resultTimestamps) : '';
        const curr = buildLabel(data[i], i, resultTimestamps);
        bands.push({ x1: prev, x2: curr });
      }
    }
    return bands;
  }, [data, lastMarkedIdx, mode, resultTimestamps]);

  // Build chart points array
  const points = useMemo<ChartPoint[]>(() => {
    const labelInterval = Math.max(1, Math.ceil(data.length / MAX_LABELS));
    let lastEmittedLabel: string | null = null;
    return data.map((d, i) => {
      const isProjected = i > lastMarkedIdx;
      // Split the weight into two series so the logged sessions (solid gold) and
      // the planned projection (dashed/dimmed) read as different things. The
      // junction point (lastMarkedIdx) belongs to both so the lines join cleanly.
      const realWeight = i <= lastMarkedIdx ? d.weight : null;
      const projWeight = i >= lastMarkedIdx ? d.weight : null;

      // A tick is emitted on the interval (and always for the final point). Skip
      // the label when it duplicates the previously emitted one so adjacent ticks
      // (e.g. the logged point and the first projected point both at the origin)
      // don't overprint as "#1#1". `_${i}` is a sentinel the tickFormatter blanks.
      const wantsLabel = i % labelInterval === 0 || i === data.length - 1;
      let x = `_${i}`;
      if (wantsLabel) {
        const candidate = buildLabel(d, i, resultTimestamps);
        if (candidate !== lastEmittedLabel) {
          x = candidate;
          lastEmittedLabel = candidate;
        }
      }

      return {
        idx: i,
        x,
        weight: d.weight,
        realWeight,
        projWeight,
        result: d.result,
        isPr: prInfo.prSet.has(i),
        isCurrentPr: i === prInfo.currentMaxIdx,
        stage: d.stage,
        date: d.date,
        amrapReps: d.amrapReps,
        isProjected,
      };
    });
  }, [data, lastMarkedIdx, prInfo, resultTimestamps]);

  if (lastMarkedIdx < 0) {
    return (
      <div
        className="flex items-center justify-center h-[clamp(200px,25vw,300px)]"
        style={{ background: theme.bg }}
      >
        <p className="font-mono text-xs text-[var(--color-chart-text)]">{t('chart.empty')}</p>
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center h-[clamp(200px,25vw,300px)]"
        style={{ background: theme.bg }}
      >
        <p className="font-mono text-xs text-[var(--color-chart-text)]">
          {t('chart.insufficient_data')}
        </p>
      </div>
    );
  }

  const hasProjection = lastMarkedIdx < data.length - 1;

  const tickFormatter = (val: string): string => (val.startsWith('_') ? '' : val);

  return (
    <figure>
      <figcaption className="sr-only">{label}</figcaption>
      {hasProjection && mode === 'weight' && (
        <div className="flex items-center gap-4 mb-2 font-mono text-2xs text-muted">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block w-4 h-0.5"
              style={{ background: theme.line }}
            />
            {t('chart.legend_real')}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block w-4 border-t border-dashed"
              style={{ borderColor: theme.line, opacity: 0.5 }}
            />
            {t('chart.legend_projection')}
          </span>
        </div>
      )}
      <div style={{ width: '100%', height: 'clamp(200px, 25vw, 300px)', minHeight: 200 }}>
        {/* initialDimension gives recharts a positive size on the very first paint
            (its default is {-1,-1}, which logs the "width(-1)/height(-1)" warning)
            before the ResizeObserver reports the real box and corrects it. */}
        <ResponsiveContainer
          width="100%"
          height="100%"
          minHeight={200}
          initialDimension={{ width: 320, height: 220 }}
        >
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 2 }}>
            <CartesianGrid stroke={theme.grid} strokeWidth={0.5} vertical={false} />
            <XAxis
              dataKey="x"
              tick={{ fill: theme.text, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={tickFormatter}
              interval={0}
              minTickGap={20}
            />
            <YAxis
              tick={{ fill: theme.text, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              width={36}
              label={
                yAxisLabel && mode === 'numeric'
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: 'insideLeft',
                      fill: theme.text,
                      fontSize: 9,
                    }
                  : undefined
              }
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Deload bands */}
            {deloadBands.map((band, i) => (
              <ReferenceLine
                key={`dl-${i}`}
                x={band.x2}
                stroke={theme.fail}
                strokeOpacity={0.15}
                strokeWidth={20}
              />
            ))}

            {/* Stage markers */}
            {stageChanges.map((i) => (
              <ReferenceLine
                key={`stage-${i}`}
                x={points[i].x}
                stroke={theme.fail}
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{
                  value: `S${data[i].stage}`,
                  fill: theme.text,
                  fontSize: 9,
                  position: 'top',
                }}
              />
            ))}

            {/* Planned projection — dashed + dimmed so it never reads as logged
                data. Drawn first so the solid logged series sits on top at the
                junction. `connectNulls={false}` keeps it off the logged segment. */}
            {hasProjection && (
              <Line
                type="stepAfter"
                dataKey="projWeight"
                stroke={theme.line}
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeOpacity={0.3}
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}

            {/* Logged sessions — solid gold stepped fill + line with result
                markers (machined, no curves). */}
            <Area
              type="stepAfter"
              dataKey="realWeight"
              stroke={theme.line}
              strokeWidth={2}
              fill={theme.line}
              fillOpacity={0.07}
              dot={<CustomDot />}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <details className="sr-only">
        <summary>{t('chart.data_summary', { label })}</summary>
        <table>
          <thead>
            <tr>
              <th>{t('chart.workout_header')}</th>
              <th>{t('chart.weight_header')}</th>
              <th>{t('chart.result_header')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.workout}>
                <td>{p.workout}</td>
                <td>{p.weight}</td>
                <td>{p.result ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
