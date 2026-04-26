import { useMemo } from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { VolumeDataPoint } from '@gzclp/domain/types';
import { getChartTheme, formatChartDate } from './chart-theme';
import { formatVolLabel, VolumeTooltip } from './volume-tooltip';

const MAX_LABELS = 8;

interface BarChartProps {
  readonly data: readonly VolumeDataPoint[];
  readonly label: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BarChart({ data, label }: BarChartProps): React.ReactNode {
  const theme = getChartTheme();

  const points = useMemo(() => {
    const labelInterval = Math.max(1, Math.ceil(data.length / MAX_LABELS));
    return data.map((d, i) => ({
      x:
        i % labelInterval === 0
          ? d.date
            ? formatChartDate(d.date) || `#${d.workout}`
            : `#${d.workout}`
          : `_${i}`,
      vol: d.volumeKg,
    }));
  }, [data]);

  const avg = useMemo(
    () =>
      data.length >= 3 ? Math.round(data.reduce((s, d) => s + d.volumeKg, 0) / data.length) : null,
    [data]
  );

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-[clamp(200px,25vw,300px)]"
        style={{ background: theme.bg }}
      >
        <p className="font-mono text-xs text-[var(--color-chart-text)]">Sin datos de volumen</p>
      </div>
    );
  }

  const tickFormatter = (val: string): string => (val.startsWith('_') ? '' : val);

  return (
    <figure data-testid="volume-chart">
      <figcaption className="sr-only">{label}</figcaption>
      <div style={{ height: 'clamp(200px, 25vw, 300px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 2 }}>
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
              width={40}
              tickFormatter={formatVolLabel}
              label={{
                value: 'kg',
                angle: -90,
                position: 'insideLeft',
                fill: theme.text,
                fontSize: 9,
              }}
            />
            <Tooltip content={<VolumeTooltip />} />
            <Bar dataKey="vol" fill={theme.line} fillOpacity={0.8} isAnimationActive={false} />
            {avg !== null && (
              <ReferenceLine
                y={avg}
                stroke={theme.text}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: `avg ${formatVolLabel(avg)} kg`,
                  fill: theme.text,
                  fontSize: 9,
                  position: 'insideTopRight',
                }}
              />
            )}
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
