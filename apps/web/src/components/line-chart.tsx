import { memo, useRef, useEffect } from 'react';
import type { ChartDataPoint } from '@gzclp/shared/types';

interface LineChartProps {
  data: ChartDataPoint[];
  label: string;
}

export const LineChart = memo(function LineChart({ data, label }: LineChartProps) {
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
    const gridColor = style.getPropertyValue('--chart-grid').trim() || '#ddd';
    const textColor = style.getPropertyValue('--chart-text').trim() || '#666';
    const lineColor = style.getPropertyValue('--chart-line').trim() || '#333';
    const successColor = style.getPropertyValue('--chart-success').trim() || '#4caf50';
    const failColor = style.getPropertyValue('--chart-fail').trim() || '#ef5350';
    const bgColor = style.getPropertyValue('--bg-th').trim() || '#fafafa';

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
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Completa entrenamientos para ver el gráfico', W / 2, H / 2);
      return;
    }

    if (data.length < 2) {
      ctx.fillStyle = textColor;
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Datos insuficientes aún', W / 2, H / 2);
      return;
    }

    const pad = { top: 20, right: 20, bottom: 30, left: 50 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;
    const plotFloor = pad.top + plotH;

    const weights = data.map((d) => d.weight);
    const minW = Math.floor(Math.min(...weights) / 5) * 5 - 5;
    const maxW = Math.ceil(Math.max(...weights) / 5) * 5 + 5;
    const range = maxW - minW || 10;

    const x = (i: number): number => pad.left + (i / (data.length - 1)) * plotW;
    const y = (w: number): number => pad.top + plotH - ((w - minW) / range) * plotH;

    const DOT_RADIUS = 4;
    const PR_RADIUS = 6;
    const FAIL_ARM = 3.5;

    // --- Drawing helpers (share ctx, coordinate fns, colors via closure) ---

    function drawGrid(): void {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.5;
      const step = range <= 30 ? 5 : range <= 60 ? 10 : 20;
      for (let w = minW; w <= maxW; w += step) {
        ctx.beginPath();
        ctx.moveTo(pad.left, y(w));
        ctx.lineTo(W - pad.right, y(w));
        ctx.stroke();
        ctx.fillStyle = textColor;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(w), pad.left - 6, y(w) + 3);
      }

      ctx.fillStyle = textColor;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      const labelInterval = Math.max(1, Math.floor(data.length / 6));
      for (let i = 0; i < data.length; i += labelInterval) {
        ctx.fillText(`#${data[i].workout}`, x(i), H - 8);
      }
    }

    function drawDeloadBands(): void {
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
      grad.addColorStop(0, fillHex + '1F'); // ~12% opacity
      grad.addColorStop(1, fillHex + '00'); // fully transparent
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

    function drawPrMarker(): void {
      let prIdx = -1;
      let prWeight = -Infinity;
      for (let i = 0; i <= lastMarkedIdx; i++) {
        if (data[i].result === 'success' && data[i].weight >= prWeight) {
          prWeight = data[i].weight;
          prIdx = i;
        }
      }
      if (prIdx >= 0) {
        ctx.beginPath();
        ctx.arc(x(prIdx), y(data[prIdx].weight), PR_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();
      }
    }

    function drawStageMarkers(): void {
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
          ctx.font = '9px sans-serif';
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
    drawPrMarker();
    drawStageMarkers();
  }, [data, label]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Gráfico de progresión de peso: ${label}`}
      className="w-full h-[200px]"
    />
  );
});
