import type { ResultValue } from '@gzclp/domain/types';
import { useTranslation } from 'react-i18next';

interface ResultCellProps {
  readonly index: number;
  /** Slot identifier passed through to the mark/undo callbacks (e.g. "d1-t1"). */
  readonly tier: string;
  /** Human-readable exercise name for accessible labels (e.g. "Press Militar"). */
  readonly exerciseName: string;
  /** Human-readable tier label for accessible labels (e.g. "T1"). */
  readonly tierLabel: string;
  readonly result?: ResultValue;
  readonly variant: 'table' | 'card';
  /** True for test slots — renders a single "Registrar Maximo" button instead of Pass/Fail. */
  readonly isTestSlot?: boolean;
  /** True when set logging is in progress — buttons are visually muted but remain functional. */
  readonly isSetLogging?: boolean;
  readonly onMark: (index: number, tier: string, value: ResultValue) => void;
  readonly onUndo: (index: number, tier: string) => void;
}

export function ResultCell({
  index,
  tier,
  exerciseName,
  tierLabel,
  result,
  variant,
  isTestSlot,
  isSetLogging,
  onMark,
  onUndo,
}: ResultCellProps): React.ReactNode {
  const { t } = useTranslation();
  const isTable = variant === 'table';

  if (result) {
    const isSuccess = result === 'success';
    const badgeColor = isSuccess
      ? 'bg-ok-bg border-ok-ring text-ok'
      : 'bg-fail-bg border-fail-ring text-fail';
    const padding = isTable ? 'px-3.5 py-1.5' : 'px-3 py-1';
    const tableStyles = isTable
      ? 'group relative inline-block transition-transform hover:scale-110'
      : '';
    const resultLabel = isSuccess
      ? t('tracker.result_cell.success')
      : t('tracker.result_cell.fail');

    return (
      <button
        type="button"
        onClick={() => onUndo(index, tier)}
        aria-label={t('tracker.result_cell.aria_undo', {
          exercise: exerciseName,
          tier: tierLabel,
          result: resultLabel,
        })}
        data-testid="result-cell-undo"
        className={`${padding} min-h-9 text-sm font-bold cursor-pointer border rounded-control animate-[pop-in_0.25s_cubic-bezier(0.16,1,0.3,1)] active:translate-y-px transition-transform duration-[var(--duration-press)] ${badgeColor} ${tableStyles}`}
      >
        {isSuccess ? '\u2713' : '\u2717'}
        {/* fix: tooltip only on hover, not on focus (aria-label handles a11y) */}
        {isTable ? (
          <span
            className="absolute -top-5.5 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap bg-tooltip-bg text-tooltip-text px-2 py-0.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden="true"
          >
            {t('tracker.toolbar.undo_button')}
          </span>
        ) : null}
        {!isTable && (
          <>
            {' '}
            <span className="text-xs font-normal opacity-70" aria-hidden="true">
              {t('tracker.toolbar.undo_button')}
            </span>
          </>
        )}
      </button>
    );
  }

  // Test slot: single "Register Max" button instead of Pass/Fail pair
  if (isTestSlot === true) {
    const testSizeClasses = isTable
      ? 'min-h-[44px] px-3 py-1.5 text-xs'
      : 'min-h-[48px] px-3 py-2 text-xs';

    return (
      <button
        type="button"
        onClick={() => onMark(index, tier, 'success')}
        aria-label={t('tracker.result_cell.aria_register_max', {
          exercise: exerciseName,
          tier: tierLabel,
        })}
        data-testid="result-cell-register-max"
        className={`${testSizeClasses} type-button border border-accent-deep bg-transparent text-accent rounded-control cursor-pointer transition-[background-color,transform] duration-[var(--duration-press)] hover:bg-accent/10 active:translate-y-px whitespace-nowrap`}
      >
        {t('tracker.result_cell.register_max_label', { tier: tierLabel })}
      </button>
    );
  }

  const sizeClasses = isTable
    ? 'min-w-[44px] min-h-[44px] px-3.5 py-2 text-sm'
    : 'min-w-[48px] min-h-[48px] px-3 py-2 text-base';

  const mutedClass = isSetLogging === true ? 'opacity-40' : '';

  return (
    <div className={`flex ${isTable ? 'gap-1 justify-center' : 'gap-2.5'} ${mutedClass}`}>
      <button
        type="button"
        onClick={() => onMark(index, tier, 'success')}
        aria-label={t('tracker.result_cell.aria_mark_success', {
          exercise: exerciseName,
          tier: tierLabel,
        })}
        data-testid="result-cell-mark-success"
        className={`${sizeClasses} font-bold border border-ok-ring bg-transparent text-ok rounded-control cursor-pointer transition-[background-color,transform] duration-[var(--duration-press)] hover:bg-ok-bg active:translate-y-px`}
      >
        &#10003;
      </button>
      <button
        type="button"
        onClick={() => onMark(index, tier, 'fail')}
        aria-label={t('tracker.result_cell.aria_mark_fail', {
          exercise: exerciseName,
          tier: tierLabel,
        })}
        data-testid="result-cell-mark-fail"
        className={`${sizeClasses} font-bold border border-fail-ring bg-transparent text-fail rounded-control cursor-pointer transition-[background-color,transform] duration-[var(--duration-press)] hover:bg-fail-bg active:translate-y-px`}
      >
        &#10007;
      </button>
    </div>
  );
}
