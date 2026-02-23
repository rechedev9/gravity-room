import { memo } from 'react';
import type { Tier, ResultValue } from '@gzclp/shared/types';

interface ResultCellProps {
  readonly index: number;
  readonly tier: Tier;
  readonly result?: ResultValue;
  readonly variant: 'table' | 'card';
  readonly onMark: (index: number, tier: Tier, value: ResultValue) => void;
  readonly onUndo: (index: number, tier: Tier) => void;
}

export const ResultCell = memo(function ResultCell({
  index,
  tier,
  result,
  variant,
  onMark,
  onUndo,
}: ResultCellProps): React.ReactNode {
  const isTable = variant === 'table';

  if (result) {
    const isSuccess = result === 'success';
    const badgeColor = isSuccess
      ? 'bg-[var(--bg-badge-ok)] border-[var(--border-badge-ok)] text-[var(--text-badge-ok)]'
      : 'bg-[var(--bg-badge-no)] border-[var(--border-badge-no)] text-[var(--text-badge-no)]';
    const padding = isTable ? 'px-3.5 py-1.5' : 'px-3 py-1';
    const tableStyles = isTable
      ? 'group relative inline-block transition-transform hover:scale-110'
      : '';

    return (
      <button
        onClick={() => onUndo(index, tier)}
        aria-label={`Deshacer ${tier} ${isSuccess ? 'éxito' : 'fallo'}`}
        className={`${padding} text-[13px] font-extrabold cursor-pointer border-3 rounded-sm animate-[pop-in_0.25s_ease-out] focus-visible:ring-2 focus-visible:ring-[var(--fill-progress)] focus-visible:outline-none ${badgeColor} ${tableStyles}`}
      >
        {isSuccess ? '\u2713' : '\u2717'}
        {/* fix: tooltip only on hover, not on focus (aria-label handles a11y) */}
        {isTable ? (
          <span className="absolute -top-5.5 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap bg-[var(--bg-tooltip)] text-[var(--text-tooltip)] px-2 py-0.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            deshacer
          </span>
        ) : null}
        {!isTable && (
          <>
            {' '}
            <span className="text-xs font-normal opacity-70">deshacer</span>
          </>
        )}
      </button>
    );
  }

  const sizeClasses = isTable
    ? 'min-w-[44px] min-h-[44px] px-3.5 py-2 text-sm'
    : 'min-w-[48px] min-h-[48px] px-3 py-2 text-base';

  return (
    <div className={`flex ${isTable ? 'gap-1 justify-center' : 'gap-2.5'}`}>
      <button
        onClick={() => onMark(index, tier, 'success')}
        aria-label={`Marcar ${tier} éxito`}
        className={`${sizeClasses} font-extrabold border-2 border-[var(--border-badge-ok)] bg-transparent text-[var(--text-badge-ok)] rounded-sm cursor-pointer transition-all hover:bg-[var(--bg-badge-ok)] focus-visible:ring-2 focus-visible:ring-[var(--fill-progress)] focus-visible:outline-none`}
      >
        &#10003;
      </button>
      <button
        onClick={() => onMark(index, tier, 'fail')}
        aria-label={`Marcar ${tier} fallo`}
        className={`${sizeClasses} font-extrabold border-2 border-[var(--border-badge-no)] bg-transparent text-[var(--text-badge-no)] rounded-sm cursor-pointer transition-all hover:bg-[var(--bg-badge-no)] focus-visible:ring-2 focus-visible:ring-[var(--fill-progress)] focus-visible:outline-none`}
      >
        &#10007;
      </button>
    </div>
  );
});
