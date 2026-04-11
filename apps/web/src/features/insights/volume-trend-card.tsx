import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { InsightItem } from '@/lib/api-functions';
import { isVolumeTrendPayload } from '@/lib/insight-payloads';
import { getChartTheme, formatChartDate } from '@/components/charts/chart-theme';
import { formatVolLabel, VolumeTooltip } from '@/components/charts/volume-tooltip';

const MAX_LABELS = 8;

interface VolumeTrendCardProps {
  readonly insight: InsightItem;
}

export function VolumeTrendCard({ insight }: VolumeTrendCardProps): React.ReactNode {
  const { t } = useTranslation();
  const payload = insight.payload;
  if (!isVolumeTrendPayload(payload)) return null;

  const theme = getChartTheme();

  const points = useMemo(() => {
    const labelInterval = Math.max(1, Math.ceil(payload.weeks.length / MAX_LABELS));
    return payload.weeks.map((week, i) => ({
      x: i % labelInterval === 0 ? formatChartDate(week) || `#${i + 1}` : `_${i}`,
      vol: payload.volumes[i] ?? 0,
    }));
  }, [payload.weeks, payload.volumes]);

  const avg = useMemo(
    () =>
      payload.volumes.length >= 3
        ? Math.round(payload.volumes.reduce((s, v) => s + v, 0) / payload.volumes.length)
        : null,
    [payload.volumes]
  );

  const tickFormatter = (val: string): string => (val.startsWith('_') ? '' : val);

  const directionLabel =
    payload.direction === 'up'
      ? t('insights.volume_trend.direction_up')
      : payload.direction === 'down'
        ? t('insights.volume_trend.direction_down')
        : t('insights.volume_trend.direction_stable');

  return (
    <div className="bg-card border border-rule card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest">
          {t('insights.volume_trend.title')}
        </h3>
        <span className="font-mono text-[10px] text-muted">{directionLabel}</span>
      </div>
      {points.length === 0 ? (
        <div
          className="flex items-center justify-center h-[clamp(200px,25vw,300px)]"
          style={{ background: theme.bg }}
        >
          <p className="font-mono text-xs text-[var(--color-chart-text)]">
            {t('insights.volume_trend.no_data')}
          </p>
        </div>
      ) : (
        <figure data-testid="volume-chart">
          <figcaption className="sr-only">{t('insights.volume_trend.chart_sr_only')}</figcaption>
          <div style={{ height: 'clamp(200px, 25vw, 300px)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 2 }}>
                <defs>
                  <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.line} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={theme.line} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
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
                <Area
                  type="monotone"
                  dataKey="vol"
                  stroke={theme.line}
                  strokeWidth={2}
                  fill="url(#volFill)"
                  animationDuration={320}
                  animationEasing="ease-out"
                />
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
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </figure>
      )}
    </div>
  );
}
