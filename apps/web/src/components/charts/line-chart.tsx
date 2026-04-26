import { useMemo } from 'react';
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

function CustomDot(props: DotProps & { payload?: ChartPoint }): React.ReactElement | null {
  const { cx, cy, payload } = props;
  if (!payload || cx === undefined || cy === undefined) return null;

  const theme = getChartTheme();

  if (payload.isProjected) return null;

  if (payload.isCurrentPr) {
    return (
      <g key={`pr-cur-${payload.idx}`}>
        <circle cx={cx} cy={cy} r={7} fill={theme.pr} opacity={0.25} />
        <circle cx={cx} cy={cy} r={5} fill={theme.pr} />
      </g>
    );
  }

  if (payload.isPr) {
    return <circle key={`pr-${payload.idx}`} cx={cx} cy={cy} r={4} fill={theme.pr} />;
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
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  if (!pt || pt.result === null) return null;

  const resultLabel = pt.result === 'success' ? '✓ Éxito' : '✗ Fallo';
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
    return data.map((d, i) => ({
      idx: i,
      x:
        i % labelInterval === 0 || i === data.length - 1
          ? buildLabel(d, i, resultTimestamps)
          : `_${i}`,
      weight: d.weight,
      result: d.result,
      isPr: prInfo.prSet.has(i),
      isCurrentPr: i === prInfo.currentMaxIdx,
      stage: d.stage,
      date: d.date,
      amrapReps: d.amrapReps,
      isProjected: i > lastMarkedIdx,
    }));
  }, [data, lastMarkedIdx, prInfo, resultTimestamps]);

  if (lastMarkedIdx < 0) {
    return (
      <div
        className="flex items-center justify-center h-[clamp(200px,25vw,300px)]"
        style={{ background: theme.bg }}
      >
        <p className="font-mono text-xs text-[var(--color-chart-text)]">
          Completa entrenamientos para ver el gráfico
        </p>
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center h-[clamp(200px,25vw,300px)]"
        style={{ background: theme.bg }}
      >
        <p className="font-mono text-xs text-[var(--color-chart-text)]">Datos insuficientes aún</p>
      </div>
    );
  }

  const solidPoints = points.slice(0, lastMarkedIdx + 1);
  const projectedPoints = lastMarkedIdx < data.length - 1 ? points.slice(lastMarkedIdx) : [];

  const tickFormatter = (val: string): string => (val.startsWith('_') ? '' : val);

  return (
    <figure>
      <figcaption className="sr-only">{label}</figcaption>
      <div style={{ height: 'clamp(200px, 25vw, 300px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={solidPoints} margin={{ top: 8, right: 8, bottom: 4, left: 2 }}>
            <CartesianGrid stroke={theme.grid} strokeWidth={0.5} vertical={false} />
            <XAxis
              dataKey="x"
              tick={{ fill: theme.text, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={tickFormatter}
              interval={0}
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

            {/* Gradient fill + solid line */}
            <Area
              type="monotone"
              dataKey="weight"
              stroke={theme.line}
              strokeWidth={2}
              fill={theme.line}
              fillOpacity={0.08}
              dot={<CustomDot />}
              activeDot={false}
              isAnimationActive={false}
            />

            {/* Projected (future) line */}
            {projectedPoints.length > 0 && (
              <Line
                data={projectedPoints}
                type="monotone"
                dataKey="weight"
                stroke={theme.line}
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeOpacity={0.3}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <details className="sr-only">
        <summary>Datos: {label}</summary>
        <table>
          <thead>
            <tr>
              <th>Ent.</th>
              <th>Peso</th>
              <th>Resultado</th>
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
