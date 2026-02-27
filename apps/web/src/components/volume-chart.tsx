import { useRef, useEffect } from 'react';
import type { VolumeDataPoint } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', { month: 'short', day: 'numeric' });
const MAX_X_LABELS = 8;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VolumeChartProps {
  readonly data: readonly VolumeDataPoint[];
  readonly label: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateLabel(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return DATE_FORMATTER.format(parsed);
}

function formatVolumeLabel(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(kg % 1000 === 0 ? 0 : 1)}k`;
  return String(kg);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VolumeChart({ data, label }: VolumeChartProps): React.ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const rawCtx = canvas.getContext('2d');
    if (!rawCtx) return;
    rawCtx.scale(dpr, dpr);
    const ctx = rawCtx;
    const W = rect.width;
    const H = rect.height;

    const style = getComputedStyle(document.documentElement);
    const barColor = style.getPropertyValue('--color-chart-line').trim() || '#333';
    const textColor = style.getPropertyValue('--color-chart-text').trim() || '#666';
    const bgColor = style.getPropertyValue('--color-th').trim() || '#fafafa';
    const gridColor = style.getPropertyValue('--color-chart-grid').trim() || '#ddd';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    if (data.length === 0) {
      ctx.fillStyle = textColor;
      ctx.font = '13px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Sin datos de volumen', W / 2, H / 2);
      return;
    }

    const pad = { top: 20, right: 20, bottom: 30, left: 60 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;
    const maxVol = Math.max(...data.map((d) => d.volumeKg));
    const ceilingVol = maxVol > 0 ? maxVol * 1.1 : 1000;

    // Y-axis grid and labels
    const step = ceilingVol <= 5000 ? 1000 : ceilingVol <= 20000 ? 5000 : 10000;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    for (let v = 0; v <= ceilingVol + step; v += step) {
      const yPos = pad.top + plotH - (v / ceilingVol) * plotH;
      if (yPos >= pad.top && yPos <= pad.top + plotH) {
        // Grid line
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(pad.left, yPos);
        ctx.lineTo(W - pad.right, yPos);
        ctx.stroke();
        // Label
        ctx.fillStyle = textColor;
        ctx.fillText(`${formatVolumeLabel(v)}`, pad.left - 6, yPos + 3);
      }
    }

    // Y-axis annotation
    ctx.save();
    ctx.fillStyle = textColor;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.translate(10, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('kg', 0, 0);
    ctx.restore();

    // Bars
    const gap = plotW / data.length;
    const barWidth = Math.min(gap * 0.7, 40);

    for (let i = 0; i < data.length; i++) {
      const barH = (data[i].volumeKg / ceilingVol) * plotH;
      const bx = pad.left + gap * i + (gap - barWidth) / 2;
      const by = pad.top + plotH - barH;

      ctx.fillStyle = barColor;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(bx, by, barWidth, barH);
      ctx.globalAlpha = 1;
    }

    // Average line (dashed) — only when 3+ data points
    if (data.length >= 3) {
      const avg = data.reduce((sum, d) => sum + d.volumeKg, 0) / data.length;
      const avgY = pad.top + plotH - (avg / ceilingVol) * plotH;

      ctx.save();
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, avgY);
      ctx.lineTo(W - pad.right, avgY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Average annotation
      ctx.fillStyle = textColor;
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`avg ${formatVolumeLabel(Math.round(avg))} kg`, W - pad.right + 2, avgY - 4);
      ctx.restore();
    }

    // X-axis labels
    ctx.fillStyle = textColor;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    const labelInterval = Math.max(1, Math.ceil(data.length / MAX_X_LABELS));
    for (let i = 0; i < data.length; i += labelInterval) {
      const point = data[i];
      let xLabel: string;
      if (point.date) {
        const formatted = formatDateLabel(point.date);
        xLabel = formatted || `#${point.workout}`;
      } else {
        xLabel = `#${point.workout}`;
      }
      const cx = pad.left + gap * i + gap / 2;
      ctx.fillText(xLabel, cx, H - 8);
    }
  }, [data, label]);

  return (
    <figure data-testid="volume-chart">
      <figcaption className="sr-only">{label}</figcaption>
      <div className="relative w-full" style={{ height: 'clamp(200px, 25vw, 300px)' }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Gr\u00e1fico de volumen por sesi\u00f3n: ${label}`}
          className="h-full w-full"
        />
      </div>
    </figure>
  );
}
