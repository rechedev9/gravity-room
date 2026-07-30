import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '@/hooks/use-click-outside';

const RPE_VALUES = [5, 6, 7, 8, 9, 10] as const;

interface RpeSelectProps {
  readonly value: number | undefined;
  readonly onChange: (rpe: number | undefined) => void;
  readonly workoutIndex: number;
  readonly slotKey: string;
}

/**
 * Compact RPE control styled like the rest of the tracker (steppers, cards).
 * Uses a custom listbox popover instead of a native `<select>` so the OS
 * chrome never breaks the dark theme.
 */
export function RpeSelect({ value, onChange, workoutIndex, slotKey }: RpeSelectProps): ReactNode {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const hasValue = value !== undefined;

  const close = useCallback((): void => setOpen(false), []);
  useClickOutside(rootRef, close);

  const pick = (next: number | undefined): void => {
    onChange(next);
    setOpen(false);
  };

  const label = hasValue
    ? t('tracker.rpe_select.value', { n: value })
    : t('tracker.rpe_select.none');

  return (
    <span ref={rootRef} className="relative inline-flex items-center">
      <button
        type="button"
        data-rpe-input={`${workoutIndex}-${slotKey}`}
        data-testid="rpe-select-trigger"
        aria-label={t('tracker.rpe_select.label')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`appearance-none bg-card border border-rule text-xs font-bold pl-2.5 pr-6 py-1.5 min-h-[36px] min-w-[72px] cursor-pointer rounded-[var(--radius-base)] transition-colors hover:border-rule-light focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none text-left ${
          hasValue ? 'text-main' : 'text-muted'
        }`}
      >
        {label}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-muted"
        >
          {'▾'}
        </span>
      </button>

      {open ? (
        <ul
          role="listbox"
          data-testid="rpe-select-listbox"
          aria-label={t('tracker.rpe_select.label')}
          className="absolute z-50 bottom-full mb-1.5 left-0 min-w-full bg-card border border-rule py-1 shadow-elevated rounded-[var(--radius-base)]"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={!hasValue}
              data-testid="rpe-option-none"
              onClick={() => pick(undefined)}
              className={`w-full text-left px-3 py-2 text-xs font-bold cursor-pointer transition-colors hover:bg-hover-row focus-visible:bg-hover-row focus-visible:outline-none ${
                !hasValue ? 'text-accent' : 'text-muted'
              }`}
            >
              {t('tracker.rpe_select.none')}
            </button>
          </li>
          {RPE_VALUES.map((v) => {
            const selected = value === v;
            return (
              <li key={v} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-testid={`rpe-option-${v}`}
                  onClick={() => pick(v)}
                  className={`w-full text-left px-3 py-2 text-xs font-bold cursor-pointer transition-colors hover:bg-hover-row focus-visible:bg-hover-row focus-visible:outline-none ${
                    selected ? 'text-accent' : 'text-main'
                  }`}
                >
                  {t('tracker.rpe_select.value', { n: v })}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </span>
  );
}
