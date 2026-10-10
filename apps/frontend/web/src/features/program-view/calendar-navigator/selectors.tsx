import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentedChoice } from '@/components/segmented-choice';
import type { NavMode } from '../program-navigation-preference';

// ---------------------------------------------------------------------------
// NavModeSelector — segmented Día | Semana | Mes
// ---------------------------------------------------------------------------

const NAV_MODES: NavMode[] = ['day', 'week', 'month'];

interface NavModeSelectorProps {
  mode: NavMode;
  onChange: (mode: NavMode) => void;
}

export function NavModeSelector({ mode, onChange }: NavModeSelectorProps): ReactNode {
  const { t } = useTranslation();
  return (
    <SegmentedChoice
      className="self-start"
      label={t('calendar_navigator.nav_mode_group_aria')}
      value={mode}
      options={NAV_MODES.map((m) => ({ value: m, label: t(`calendar_navigator.nav_mode.${m}`) }))}
      onChange={onChange}
    />
  );
}

// ---------------------------------------------------------------------------
// ReadingSelector — Plan | Historial real (tracker only)
// ---------------------------------------------------------------------------

export type ReadingMode = 'program' | 'history';

const READING_MODES = ['program', 'history'] satisfies ReadingMode[];

interface ReadingSelectorProps {
  mode: ReadingMode;
  onChange: (mode: ReadingMode) => void;
}

export function ReadingSelector({ mode, onChange }: ReadingSelectorProps): ReactNode {
  const { t } = useTranslation();
  return (
    <SegmentedChoice
      className="self-start"
      label={t('calendar_navigator.reading_mode_group_aria')}
      value={mode}
      options={READING_MODES.map((m) => ({
        value: m,
        label: t(`calendar_navigator.reading_mode.${m}`),
      }))}
      onChange={onChange}
    />
  );
}
