import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { InsightItem } from '@/lib/api-functions';
import { getChartTheme } from '@/components/charts/chart-theme';
import { isForecastPayload } from '@/lib/insight-payloads';

interface ForecastPoint {
  readonly x: string;
  readonly e1rm: number | null;
  readonly forecastMin: number | null;
  readonly forecastMax: number | null;
  readonly forecastMid: number | null;
}

interface ForecastChartProps {
  readonly insight: InsightItem;
  readonly exerciseName?: string;
}

export function ForecastChart({ insight, exerciseName }: ForecastChartProps): React.ReactNode {
  const payload = insight.payload;
  if (!isForecastPayload(payload)) return null;

  const theme = getChartTheme();
  const accent = theme.line;
  const textColor = theme.text;
  const cardBg = theme.bg;
  const gridColor = theme.grid;

  const data = useMemo<ForecastPoint[]>(() => {
    const historical: ForecastPoint[] = payload.weeks.map((week, i) => ({
      x: week,
      e1rm: payload.e1rms[i] ?? null,
      forecastMin: null,
      forecastMax: null,
      forecastMid: null,
    }));

    const lastE1rm = payload.e1rms[payload.e1rms.length - 1] ?? 0;

    // Anchor point linking historical to forecast
    const anchor: ForecastPoint = {
      x: payload.weeks[payload.weeks.length - 1] ?? '+0w',
      e1rm: lastE1rm,
      forecastMin: lastE1rm,
      forecastMax: lastE1rm,
      forecastMid: lastE1rm,
    };

    const pt2w: ForecastPoint = {
      x: '+2w',
      e1rm: null,
      forecastMin: Math.max(0, payload.forecast2w - payload.band2w),
      forecastMax: payload.forecast2w + payload.band2w,
      forecastMid: payload.forecast2w,
    };

    const pt4w: ForecastPoint = {
      x: '+4w',
      e1rm: null,
      forecastMin: Math.max(0, payload.forecast4w - payload.band4w),
      forecastMax: payload.forecast4w + payload.band4w,
      forecastMid: payload.forecast4w,
    };

    return [...historical, anchor, pt2w, pt4w];
  }, [payload]);

  const name = exerciseName ?? insight.exerciseId ?? 'Ejercicio';

  return (
    <div className="bg-card border border-rule card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest">
          {name} — Pronóstico 1RM
        </h3>
        <span className="font-mono text-[10px] text-muted">R² {payload.rSquared.toFixed(2)}</span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="x"
            tick={{ fill: textColor, fontSize: 9, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: textColor, fontSize: 9, fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            width={32}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip
            contentStyle={{
              background: cardBg,
              border: `1px solid ${gridColor}`,
              borderRadius: 4,
              fontSize: 11,
              fontFamily: 'monospace',
            }}
            formatter={(value, name) => {
              if (typeof value !== 'number') return null;
              if (name === 'e1rm') return [`${value} kg`, '1RM'];
              if (name === 'forecastMid') return [`${value} kg`, 'Pronóstico'];
              return null;
            }}
            itemStyle={{ color: accent }}
            labelStyle={{ color: textColor }}
          />
          {/* Confidence band — no animation; stacked fill behaves oddly when animated */}
          <Area
            type="monotone"
            dataKey="forecastMin"
            stackId="band"
            stroke="none"
            fill="transparent"
            connectNulls={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="forecastMax"
            stackId="band"
            stroke="none"
            fill={accent}
            fillOpacity={0.12}
            connectNulls={false}
            isAnimationActive={false}
          />
          {/* Historical line */}
          <Line
            type="monotone"
            dataKey="e1rm"
            stroke={accent}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            animationDuration={320}
            animationEasing="ease-out"
          />
          {/* Forecast dashed line */}
          <Line
            type="monotone"
            dataKey="forecastMid"
            stroke={accent}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            connectNulls={false}
            animationDuration={320}
            animationEasing="ease-out"
          />
          <ReferenceLine x="+2w" stroke={gridColor} strokeDasharray="2 2" />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex justify-end gap-4 mt-2">
        <span className="font-mono text-[9px] text-muted">
          +2sem: <span className="text-title">{payload.forecast2w} kg</span>
        </span>
        <span className="font-mono text-[9px] text-muted">
          +4sem: <span className="text-title">{payload.forecast4w} kg</span>
        </span>
      </div>
    </div>
  );
}
