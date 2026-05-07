import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from '@tanstack/react-router';
import {
  loadTourState,
  dismissChecklist,
  shouldShowChecklist,
  shouldShowPrompt,
  startTour,
  getDismissedZones,
  dismissZoneHint,
  clearTourState,
  TOUR_ZONES,
  type TourZone,
} from './mentor-tour-storage';
import { trackEvent } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Zone deep-link config
// ---------------------------------------------------------------------------

interface ZoneConfig {
  zone: TourZone;
  to: string;
  icon: string;
}

const ZONE_CONFIGS: readonly ZoneConfig[] = [
  { zone: 'home', to: '/app', icon: '⌂' },
  { zone: 'programs', to: '/app/programs', icon: '☰' },
  { zone: 'preview', to: '/programs/gzclp', icon: '◎' },
  { zone: 'tracker', to: '/app/tracker', icon: '✓' },
  { zone: 'profile', to: '/app/profile', icon: '◉' },
];

// ---------------------------------------------------------------------------
// Compact progress dots
// ---------------------------------------------------------------------------

function ProgressDots({ total, done }: { total: number; done: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => i).map((i) => (
        <span
          key={`dot-${i}`}
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            i < done ? 'bg-accent' : 'bg-rule'
          }`}
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Checklist popover (absolutely positioned)
// ---------------------------------------------------------------------------

interface ChecklistPopoverProps {
  dismissed: ReadonlySet<TourZone>;
  onMark: (zone: TourZone) => void;
  onClose: () => void;
  onDismissAll: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function ChecklistPopover({ dismissed, onMark, onClose, onDismissAll, t }: ChecklistPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const doneCount = TOUR_ZONES.filter((z) => dismissed.has(z)).length;

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={t('mentor_tour.checklist.title')}
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute left-0 top-full mt-1 z-50 w-56 bg-card border border-rule rounded-lg shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-rule flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-accent">
          {t('mentor_tour.checklist.title')}
        </span>
        <span className="text-xs text-muted">
          {doneCount}/{TOUR_ZONES.length}
        </span>
      </div>

      {/* Zone list */}
      <ul className="py-1">
        {TOUR_ZONES.map((zone) => {
          const config = ZONE_CONFIGS.find((c) => c.zone === zone);
          if (!config) return null;
          const done = dismissed.has(zone);

          return (
            <li key={zone}>
              {done ? (
                <span className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted">
                  <span className="text-accent text-[10px]">✓</span>
                  <span className="line-through">{t(`mentor_tour.zones.${zone}.label`)}</span>
                </span>
              ) : (
                <Link
                  to={config.to}
                  onClick={() => {
                    onMark(zone);
                    onClose();
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-main hover:bg-accent/10 transition-colors focus-visible:outline-none focus-visible:bg-accent/10 min-h-[36px]"
                >
                  <span className="text-muted text-[10px] w-3 text-center shrink-0">
                    {config.icon}
                  </span>
                  {t(`mentor_tour.zones.${zone}.label`)}
                  <span className="ml-auto text-accent text-[10px]">→</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-rule">
        <button
          type="button"
          onClick={onDismissAll}
          className="text-[11px] text-muted hover:text-main transition-colors focus-visible:outline-none focus-visible:underline"
        >
          {t('mentor_tour.checklist.dismiss_all')}
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// View states
// ---------------------------------------------------------------------------

type WidgetView = 'prompt' | 'checklist' | 'hidden';

function deriveInitialView(): WidgetView {
  if (shouldShowPrompt()) return 'prompt';
  if (shouldShowChecklist()) return 'checklist';
  return 'hidden';
}

// ---------------------------------------------------------------------------
// Main widget — single compact banner row
// ---------------------------------------------------------------------------

export function HomeMentorWidget() {
  const { t } = useTranslation();

  const [view, setView] = useState<WidgetView>(() => deriveInitialView());
  const [dismissed, setDismissed] = useState<ReadonlySet<TourZone>>(() => getDismissedZones());
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Sync dismissed zones from storage on mount
  useEffect(() => {
    const state = loadTourState();
    setDismissed(new Set(state?.dismissedZones ?? []));
  }, []);

  const allDone = TOUR_ZONES.every((z) => dismissed.has(z));
  const doneCount = TOUR_ZONES.filter((z) => dismissed.has(z)).length;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStartTour = useCallback(() => {
    startTour();
    trackEvent('mentor_tutorial_start');
    setView('checklist');
  }, []);

  const handleDismissPrompt = useCallback(() => {
    dismissChecklist();
    trackEvent('mentor_tour_checklist_dismiss');
    setView('hidden');
  }, []);

  const handleDismissAll = useCallback(() => {
    dismissChecklist();
    trackEvent('mentor_tour_checklist_dismiss');
    setPopoverOpen(false);
    setView('hidden');
  }, []);

  const handleMarkZone = useCallback((zone: TourZone) => {
    dismissZoneHint(zone);
    trackEvent('mentor_tour_zone_visit', { zone });
    const next = getDismissedZones();
    setDismissed(next);
    if (TOUR_ZONES.every((z) => next.has(z))) {
      trackEvent('mentor_tutorial_complete');
      setPopoverOpen(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    clearTourState();
    trackEvent('mentor_tour_reset');
    setDismissed(new Set());
    setPopoverOpen(false);
    setView('prompt');
  }, []);

  const togglePopover = useCallback(() => {
    setPopoverOpen((v) => !v);
  }, []);

  // ── All done → tiny reset link, no card ──────────────────────────────────
  if (allDone) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 text-xs text-muted"
      >
        <span className="text-accent text-[10px]">✓</span>
        <span>{t('mentor_tour.checklist.all_done_short')}</span>
        <button
          type="button"
          onClick={handleReset}
          className="text-muted hover:text-main underline underline-offset-2 transition-colors focus-visible:outline-none"
        >
          {t('mentor_tour.checklist.repeat')}
        </button>
      </motion.div>
    );
  }

  // ── Hidden ────────────────────────────────────────────────────────────────
  if (view === 'hidden') return null;

  // ── Prompt — inline single-line banner ───────────────────────────────────
  if (view === 'prompt') {
    return (
      <AnimatePresence>
        <motion.div
          key="mentor-prompt"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="flex items-center gap-3 px-3 py-2 bg-accent/5 border border-accent/20 rounded-lg text-xs"
        >
          <span className="text-accent font-bold shrink-0 select-none" aria-hidden="true">
            ✦
          </span>
          <span className="flex-1 text-muted min-w-0 truncate">
            {t('mentor_tour.prompt.title')}
          </span>
          <button
            type="button"
            onClick={handleStartTour}
            className="shrink-0 text-accent font-semibold hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:underline min-h-[36px] px-1"
          >
            {t('mentor_tour.prompt.start')}
          </button>
          <button
            type="button"
            onClick={handleDismissPrompt}
            aria-label={t('mentor_tour.checklist.dismiss_aria')}
            className="shrink-0 text-muted hover:text-main transition-colors focus-visible:outline-none min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            ✕
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Checklist mode — compact pill with popover ────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        key="mentor-checklist"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="relative flex items-center gap-3 text-xs"
      >
        {/* Trigger button */}
        <button
          type="button"
          onClick={togglePopover}
          aria-expanded={popoverOpen}
          aria-haspopup="dialog"
          className="flex items-center gap-2 px-3 py-1.5 bg-accent/5 border border-accent/20 rounded-full hover:bg-accent/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
        >
          <span className="text-accent font-bold text-[10px] select-none" aria-hidden="true">
            ✦
          </span>
          <span className="text-muted font-medium">{t('mentor_tour.checklist.title')}</span>
          <ProgressDots total={TOUR_ZONES.length} done={doneCount} />
          <span className="text-muted text-[10px]">{popoverOpen ? '▲' : '▼'}</span>
        </button>

        {/* Dismiss all shortcut */}
        <button
          type="button"
          onClick={handleDismissAll}
          aria-label={t('mentor_tour.checklist.dismiss_aria')}
          className="text-muted hover:text-main transition-colors focus-visible:outline-none min-h-[36px] min-w-[36px] flex items-center justify-center"
        >
          ✕
        </button>

        {/* Popover */}
        <AnimatePresence>
          {popoverOpen && (
            <ChecklistPopover
              dismissed={dismissed}
              onMark={handleMarkZone}
              onClose={() => setPopoverOpen(false)}
              onDismissAll={handleDismissAll}
              t={t}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
