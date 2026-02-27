import { useRef, useEffect, useState } from 'react';
import type { ChartDataPoint } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HIT_RADIUS = 12;
const DOT_RADIUS = 4;
const PR_RADIUS = 6;
const PR_CURRENT_RADIUS = 8;
const FAIL_ARM = 3.5;
const MAX_X_LABELS = 6;
const DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', { month: 'short', day: 'numeric' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata for tooltip display -- one entry per data point index */
interface TooltipMeta {
  readonly date?: string;
  readonly isPr?: boolean;
  readonly amrapReps?: number;
  readonly rpe?: number;
}

interface LineChartProps {
  readonly data: ChartDataPoint[];
  readonly label: string;
  /** Tooltip metadata per data point index -- enables interactive tooltips */
  readonly tooltipMeta?: readonly TooltipMeta[];
  /** Map of workout index (string) to ISO date string -- for x-axis date labels */
  readonly resultTimestamps?: Readonly<Record<string, string>>;
  /** Display mode: 'weight' shows kg y-axis, 'numeric' shows raw value y-axis */
  readonly mode?: 'weight' | 'numeric';
  /** Y-axis label when mode is 'numeric' (e.g., "RPE", "Reps") */
  readonly yAxisLabel?: string;
  /** Whether to show all historical PR markers (default: true for weight mode) */
  readonly showAllPrs?: boolean;
}

/** Internal tooltip state */
interface TooltipState {
  readonly dataIndex: number;
  readonly x: number;
  readonly y: number;
}

/** Cached chart point coordinates for hit-testing */
interface ChartPoint {
  readonly dataIndex: number;
  readonly cx: number;
  readonly cy: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateLabel(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return DATE_FORMATTER.format(parsed);
}

function resultLabel(result: 'success' | 'fail' | null): string {
  if (result === 'success') return '\u2713 \u00c9xito';
  if (result === 'fail') return '\u2717 Fallo';
  return '\u2014';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LineChart({
  data,
  label,
  tooltipMeta,
  resultTimestamps,
  mode = 'weight',
  yAxisLabel,
  showAllPrs,
}: LineChartProps): React.ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartPointsRef = useRef<ChartPoint[]>([]);
  const prIndicesRef = useRef<Set<number>>(new Set());
  const [tooltipState, setTooltipState] = useState<TooltipState | null>(null);

  const effectiveShowPrs = showAllPrs ?? mode === 'weight';

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
    const gridColor = style.getPropertyValue('--chart-grid').trim() || '#ddd';
    const textColor = style.getPropertyValue('--chart-text').trim() || '#666';
    const lineColor = style.getPropertyValue('--chart-line').trim() || '#333';
    const successColor = style.getPropertyValue('--chart-success').trim() || '#4caf50';
    const failColor = style.getPropertyValue('--chart-fail').trim() || '#ef5350';
    const bgColor = style.getPropertyValue('--bg-th').trim() || '#fafafa';
    const prColor = style.getPropertyValue('--chart-pr').trim() || '#D4A843';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    // Find last data point with a marked result
    let lastMarkedIdx = -1;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].result !== null) {
        lastMarkedIdx = i;
        break;
      }
    }

    if (lastMarkedIdx < 0) {
      ctx.fillStyle = textColor;
      ctx.font = '13px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Completa entrenamientos para ver el gr\u00e1fico', W / 2, H / 2);
      chartPointsRef.current = [];
      prIndicesRef.current = new Set();
      return;
    }

    if (data.length < 2) {
      ctx.fillStyle = textColor;
      ctx.font = '13px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Datos insuficientes a\u00fan', W / 2, H / 2);
      chartPointsRef.current = [];
      prIndicesRef.current = new Set();
      return;
    }

    const pad = { top: 20, right: 20, bottom: 30, left: 50 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;
    const plotFloor = pad.top + plotH;

    // Y-axis range
    const values = mode === 'weight' ? data.map((d) => d.weight) : data.map((d) => d.weight);
    const minV = Math.floor(Math.min(...values) / 5) * 5 - 5;
    const maxV = Math.ceil(Math.max(...values) / 5) * 5 + 5;
    const range = maxV - minV || 10;

    const x = (i: number): number => pad.left + (i / (data.length - 1)) * plotW;
    const y = (w: number): number => pad.top + plotH - ((w - minV) / range) * plotH;

    // --- Drawing helpers ---

    function drawGrid(): void {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.5;
      const step = range <= 30 ? 5 : range <= 60 ? 10 : 20;
      for (let w = minV; w <= maxV; w += step) {
        ctx.beginPath();
        ctx.moveTo(pad.left, y(w));
        ctx.lineTo(W - pad.right, y(w));
        ctx.stroke();
        ctx.fillStyle = textColor;
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        const yLabel = mode === 'numeric' && yAxisLabel ? String(w) : String(w);
        ctx.fillText(yLabel, pad.left - 6, y(w) + 3);
      }

      // Y-axis annotation for numeric mode
      if (mode === 'numeric' && yAxisLabel) {
        ctx.save();
        ctx.fillStyle = textColor;
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.translate(10, pad.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yAxisLabel, 0, 0);
        ctx.restore();
      }

      // X-axis labels
      ctx.fillStyle = textColor;
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      const labelInterval = Math.max(1, Math.ceil(data.length / MAX_X_LABELS));
      for (let i = 0; i < data.length; i += labelInterval) {
        const xLabel = getXLabel(i);
        ctx.fillText(xLabel, x(i), H - 8);
      }
    }

    function getXLabel(i: number): string {
      // Try date from data point's date field
      const point = data[i];
      if (point.date) {
        const formatted = formatDateLabel(point.date);
        if (formatted) return formatted;
      }
      // Try resultTimestamps prop
      if (resultTimestamps) {
        const workoutIndex = String(point.workout - 1);
        const isoDate = resultTimestamps[workoutIndex];
        if (isoDate) {
          const formatted = formatDateLabel(isoDate);
          if (formatted) return formatted;
        }
      }
      return `#${point.workout}`;
    }

    function drawDeloadBands(): void {
      if (mode === 'numeric') return;
      const bandW = plotW / (data.length - 1);
      for (let i = 1; i <= lastMarkedIdx; i++) {
        if (data[i].weight < data[i - 1].weight && data[i].stage < data[i - 1].stage) {
          ctx.save();
          ctx.globalAlpha = 0.08;
          ctx.fillStyle = failColor;
          ctx.fillRect(x(i) - bandW / 2, pad.top, bandW, plotH);
          ctx.restore();
        }
      }
    }

    function drawProgressLine(): Path2D {
      const linePath = new Path2D();
      linePath.moveTo(x(0), y(data[0].weight));
      for (let i = 1; i <= lastMarkedIdx; i++) {
        linePath.lineTo(x(i), y(data[i].weight));
      }
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.stroke(linePath);
      return linePath;
    }

    function drawGradientFill(linePath: Path2D): void {
      ctx.save();
      const grad = ctx.createLinearGradient(0, pad.top, 0, plotFloor);
      const fillHex = (lineColor.startsWith('#') ? lineColor : '#333').slice(0, 7);
      grad.addColorStop(0, fillHex + '1F');
      grad.addColorStop(1, fillHex + '00');
      const fillPath = new Path2D();
      fillPath.addPath(linePath);
      fillPath.lineTo(x(lastMarkedIdx), plotFloor);
      fillPath.lineTo(x(0), plotFloor);
      fillPath.closePath();
      ctx.fillStyle = grad;
      ctx.fill(fillPath);
      ctx.restore();
    }

    function drawProjectedLine(): void {
      if (mode === 'numeric') return;
      if (lastMarkedIdx >= data.length - 1) return;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x(lastMarkedIdx), y(data[lastMarkedIdx].weight));
      for (let i = lastMarkedIdx + 1; i < data.length; i++) {
        ctx.lineTo(x(i), y(data[i].weight));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    function drawDots(): void {
      for (let i = 0; i < data.length; i++) {
        if (data[i].result === 'success') {
          ctx.beginPath();
          ctx.arc(x(i), y(data[i].weight), DOT_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = successColor;
          ctx.fill();
        } else if (data[i].result === 'fail') {
          const cx = x(i);
          const cy = y(data[i].weight);
          ctx.save();
          ctx.strokeStyle = failColor;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx - FAIL_ARM, cy - FAIL_ARM);
          ctx.lineTo(cx + FAIL_ARM, cy + FAIL_ARM);
          ctx.moveTo(cx + FAIL_ARM, cy - FAIL_ARM);
          ctx.lineTo(cx - FAIL_ARM, cy + FAIL_ARM);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    function drawAllPrMarkers(): void {
      if (!effectiveShowPrs) return;
      let runningMax = -Infinity;
      let currentMaxIdx = -1;
      const prSet = new Set<number>();

      // First pass: identify all PR indices and the current max
      for (let i = 0; i <= lastMarkedIdx; i++) {
        if (data[i].result === 'success' && data[i].weight > runningMax) {
          runningMax = data[i].weight;
          currentMaxIdx = i;
          prSet.add(i);
        }
      }

      prIndicesRef.current = prSet;

      // Second pass: draw markers
      for (const idx of prSet) {
        const cx = x(idx);
        const cy = y(data[idx].weight);
        const isCurrentMax = idx === currentMaxIdx;
        const radius = isCurrentMax ? PR_CURRENT_RADIUS : PR_RADIUS;

        // Filled circle
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = prColor;
        ctx.fill();

        // Outer ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
        ctx.strokeStyle = prColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    function drawStageMarkers(): void {
      if (mode === 'numeric') return;
      for (let i = 1; i < data.length; i++) {
        if (data[i].stage !== data[i - 1].stage) {
          ctx.strokeStyle = failColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x(i), pad.top);
          ctx.lineTo(x(i), plotFloor);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = textColor;
          ctx.font = '9px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`S${data[i].stage}`, x(i), pad.top - 4);
        }
      }
    }

    // --- Painter's algorithm: back-to-front layer rendering ---
    drawGrid();
    drawDeloadBands();
    const linePath = drawProgressLine();
    drawGradientFill(linePath);
    drawProjectedLine();
    drawDots();
    drawAllPrMarkers();
    drawStageMarkers();

    // Cache chart points for hit-testing
    const points: ChartPoint[] = [];
    for (let i = 0; i <= lastMarkedIdx; i++) {
      points.push({ dataIndex: i, cx: x(i), cy: y(data[i].weight) });
    }
    chartPointsRef.current = points;
  }, [data, label, resultTimestamps, mode, yAxisLabel, effectiveShowPrs]);

  // -------------------------------------------------------------------------
  // Hit-testing
  // -------------------------------------------------------------------------

  function findClosestPoint(offsetX: number, offsetY: number): number | null {
    const points = chartPointsRef.current;
    let bestIdx: number | null = null;
    let bestDist = HIT_RADIUS + 1;
    for (const pt of points) {
      const dx = pt.cx - offsetX;
      const dy = pt.cy - offsetY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = pt.dataIndex;
      }
    }
    return bestIdx;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const idx = findClosestPoint(offsetX, offsetY);
    if (idx !== null) {
      setTooltipState({ dataIndex: idx, x: offsetX, y: offsetY });
    } else {
      setTooltipState(null);
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const idx = findClosestPoint(offsetX, offsetY);
    if (idx !== null) {
      setTooltipState((prev) =>
        prev?.dataIndex === idx ? null : { dataIndex: idx, x: offsetX, y: offsetY }
      );
    } else {
      setTooltipState(null);
    }
  }

  function handlePointerLeave(): void {
    setTooltipState(null);
  }

  // -------------------------------------------------------------------------
  // Tooltip rendering
  // -------------------------------------------------------------------------

  function renderTooltip(): React.ReactNode {
    if (tooltipState === null) return null;

    const point = data[tooltipState.dataIndex];
    if (!point) return null;

    const meta = tooltipMeta?.[tooltipState.dataIndex];
    const isPr = prIndicesRef.current.has(tooltipState.dataIndex);

    // Determine date string
    const dateStr =
      meta?.date ??
      point.date ??
      (resultTimestamps ? resultTimestamps[String(point.workout - 1)] : undefined);

    const formattedDate = dateStr ? formatDateLabel(dateStr) || dateStr : undefined;

    // Flip horizontally when near right edge (right 30% of container)
    const flipH = tooltipState.x > (canvasRef.current?.getBoundingClientRect().width ?? 300) * 0.7;

    const tooltipStyle: React.CSSProperties = {
      position: 'absolute',
      top: tooltipState.y - 10,
      left: flipH ? undefined : tooltipState.x + 12,
      right: flipH
        ? (canvasRef.current?.getBoundingClientRect().width ?? 300) - tooltipState.x + 12
        : undefined,
      pointerEvents: 'none',
      zIndex: 10,
    };

    const amrapReps = meta?.amrapReps ?? point.amrapReps;

    return (
      <div
        data-testid="chart-tooltip"
        className="rounded border px-2 py-1 text-xs shadow-lg whitespace-nowrap"
        style={{
          ...tooltipStyle,
          backgroundColor: 'var(--bg-card, #1a1408)',
          borderColor: 'var(--border-color, #2a2218)',
          color: 'var(--text-tooltip, #f0e8d8)',
        }}
      >
        <div className="font-bold">
          {point.weight} kg
          {isPr && <span className="ml-1 text-[var(--chart-pr)]">PR</span>}
        </div>
        {formattedDate && <div>{formattedDate}</div>}
        <div>{resultLabel(point.result)}</div>
        {amrapReps !== undefined && amrapReps > 0 && <div>{amrapReps} reps AMRAP</div>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const hasData = data.some((d) => d.result !== null);

  return (
    <>
      <figure>
        <figcaption className="sr-only">{label}</figcaption>
        <div className="relative w-full" style={{ height: 'clamp(200px, 25vw, 300px)' }}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Gr\u00e1fico de progresi\u00f3n de peso: ${label}`}
            className="h-full w-full"
          />
          <div
            data-testid="chart-tooltip-overlay"
            className="absolute inset-0"
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerLeave={handlePointerLeave}
          />
          {renderTooltip()}
        </div>
      </figure>
      <details className="sr-only">
        <summary>Datos del gr\u00e1fico: {label}</summary>
        {!hasData ? (
          <p>No hay datos disponibles</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Entrenamiento</th>
                <th>Peso</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.workout}>
                  <td>{point.workout}</td>
                  <td>{point.weight}</td>
                  <td>{point.result ?? '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </>
  );
}
