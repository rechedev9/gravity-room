import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
    <fieldset className="contents">
      <legend className="sr-only">{t('calendar_navigator.nav_mode_group_aria')}</legend>
      <div className="flex border border-rule overflow-hidden self-start">
        {NAV_MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => onChange(m)}
            className={`
              text-xs font-semibold px-3 py-1.5 min-h-[44px]
              transition-all duration-150 active:scale-95
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
              ${
                mode === m
                  ? 'bg-accent text-bg'
                  : 'bg-card text-muted hover:bg-hover-row hover:text-main'
              }
            `}
          >
            {t(`calendar_navigator.nav_mode.${m}`)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// ReadingSelector — Programa | Historial real (tracker only)
// ---------------------------------------------------------------------------

export type ReadingMode = 'program' | 'history';

interface ReadingSelectorProps {
  mode: ReadingMode;
  onChange: (mode: ReadingMode) => void;
}

export function ReadingSelector({ mode, onChange }: ReadingSelectorProps): ReactNode {
  const { t } = useTranslation();
  return (
    <fieldset className="contents">
      <legend className="sr-only">{t('calendar_navigator.reading_mode_group_aria')}</legend>
      <div className="flex border border-rule overflow-hidden self-start">
        {(['program', 'history'] satisfies ReadingMode[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => onChange(m)}
            className={`
              text-xs font-semibold px-3 py-1.5 min-h-[44px]
              transition-all duration-150 active:scale-95
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
              ${
                mode === m
                  ? 'bg-accent text-bg'
                  : 'bg-card text-muted hover:bg-hover-row hover:text-main'
              }
            `}
          >
            {t(`calendar_navigator.reading_mode.${m}`)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
