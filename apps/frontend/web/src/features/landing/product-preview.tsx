/* ── ProductPreview ───────────────────────────────────────────────────────────
 * Reusable high-fidelity tracker UI preview shown above the fold in the hero
 * and again inside the features section.
 *
 * Renders a browser-chrome frame around a live-markup simulation of the
 * workout tracker screen. No external screenshot asset required — the markup
 * itself reads as real product UI.
 *
 * Props:
 *   alt         — accessible alt text for the figure (from content.hero.previewAlt)
 *   caption     — visible caption label (from content.hero.previewCaption)
 *   labels      — localized UI strings from content.productPreview
 *   compact     — when true, reduces internal padding for tighter contexts
 * ─────────────────────────────────────────────────────────────────────────── */

import type { ProductPreviewContent } from './content';

interface ProductPreviewProps {
  readonly alt: string;
  readonly caption: string;
  readonly labels: ProductPreviewContent;
  readonly compact?: boolean;
}

export function ProductPreview({
  alt,
  caption,
  labels,
  compact = false,
}: ProductPreviewProps): React.ReactNode {
  const pad = compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5';

  return (
    <figure role="img" aria-label={alt} className="relative max-w-md mx-auto">
      {/* Browser-chrome frame */}
      <div className="landing-preview-frame relative bg-card border border-rule-light overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-header border-b border-rule">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-rule" />
            ))}
          </div>
          <div className="flex-1 mx-2 h-4 bg-body rounded-sm flex items-center px-2">
            <span className="font-mono text-[9px] text-muted tracking-wider">
              gravityroom.app/app/tracker
            </span>
          </div>
        </div>

        {/* App body */}
        <div className={`bg-body ${pad}`}>
          {/* Program header row */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-display text-xl text-title leading-none">{labels.programLabel}</p>
              <p className="font-mono text-[10px] text-muted mt-0.5">
                {labels.dayLabel} · {labels.weekLabel}
              </p>
            </div>
            <span className="font-mono text-[9px] px-2 py-0.5 bg-ok-bg border border-ok-ring text-ok uppercase tracking-wider">
              {labels.statusLabel}
            </span>
          </div>

          {/* Current exercise card */}
          <div className="bg-card border border-rule-light p-3 mb-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-main">
                {labels.exerciseLabel}
              </p>
              <p className="font-display-data text-2xl text-accent">{labels.weightLabel}</p>
            </div>
            {/* Set grid: 3 done, 2 remaining */}
            <div className="grid grid-cols-5 gap-1.5" aria-label={labels.setsAriaLabel}>
              {[true, true, true, false, false].map((done, i) => (
                <div
                  key={i}
                  aria-label={
                    done ? labels.setCompletedAriaFn(i + 1) : labels.setPendingAriaFn(i + 1)
                  }
                  className={`h-7 border flex items-center justify-center font-mono text-[9px] ${
                    done ? 'bg-ok-bg border-ok-ring text-ok' : 'border-rule text-muted'
                  }`}
                >
                  {done ? '✓' : '5×1'}
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar row */}
          <div className="flex items-center gap-3">
            <div
              className="flex-1 h-1 bg-progress-track overflow-hidden"
              role="progressbar"
              aria-valuenow={60}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={labels.progressAriaLabel}
            >
              <div className="h-full w-3/5 bg-accent progress-fill" />
            </div>
            <span className="font-mono text-[10px] text-muted whitespace-nowrap">
              {labels.progressNote}
            </span>
          </div>
        </div>
      </div>

      {/* Visible caption */}
      <figcaption className="mt-3 text-center font-mono text-[10px] text-muted tracking-wider uppercase">
        {caption}
      </figcaption>
    </figure>
  );
}
