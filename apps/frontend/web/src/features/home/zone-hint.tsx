/**
 * ZoneHint — a small, dismissible inline hint shown once per route zone.
 *
 * Usage:
 *   <ZoneHint zone="programs" />
 *
 * The hint auto-hides after the user dismisses it and never reappears.
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import { dismissZoneHint, shouldShowZoneHint, type TourZone } from './mentor-tour-storage';
import { trackEvent } from '@/lib/analytics';

interface ZoneHintProps {
  readonly zone: TourZone;
  /** Optional extra className for the wrapper. */
  readonly className?: string;
}

export function ZoneHint({ zone, className = '' }: ZoneHintProps): React.ReactNode {
  const { t } = useTranslation();

  // Evaluate once on mount — avoids reading localStorage on every render.
  const [visible, setVisible] = useState<boolean>(() => shouldShowZoneHint(zone));

  const handleDismiss = useCallback(() => {
    dismissZoneHint(zone);
    trackEvent('mentor_tour_zone_visit', { zone });
    setVisible(false);
  }, [zone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          key={`zone-hint-${zone}`}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className={`flex items-start gap-2 bg-card border border-rule rounded-lg px-3 py-2.5 text-xs text-muted ${className}`}
          aria-label={t('mentor_tour.zone_hint.aria_label')}
        >
          {/* Sensei badge */}
          <span
            className="shrink-0 h-6 w-6 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-sm select-none"
            aria-hidden="true"
          >
            🥋
          </span>

          {/* Hint text */}
          <p className="flex-1 leading-relaxed">{t(`mentor_tour.zones.${zone}.hint`)}</p>

          {/* Dismiss */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t('mentor_tour.zone_hint.dismiss_aria')}
            className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted hover:text-main transition-colors focus-visible:outline-none focus-visible:underline ml-1"
          >
            ✕
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
