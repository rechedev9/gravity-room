import type { ResultValue } from '@gzclp/shared/types';

interface ResultCellProps {
  readonly index: number;
  readonly tier: string;
  readonly result?: ResultValue;
  readonly variant: 'table' | 'card';
  /** True for test slots — renders a single "Registrar Maximo" button instead of Pass/Fail. */
  readonly isTestSlot?: boolean;
  readonly onMark: (index: number, tier: string, value: ResultValue) => void;
  readonly onUndo: (index: number, tier: string) => void;
}

export function ResultCell({
  index,
  tier,
  result,
  variant,
  isTestSlot,
  onMark,
  onUndo,
}: ResultCellProps): React.ReactNode {
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

    return (
      <button
        onClick={() => onUndo(index, tier)}
        aria-label={`Deshacer ${tier} ${isSuccess ? 'éxito' : 'fallo'}`}
        className={`${padding} text-[13px] font-extrabold cursor-pointer border-3 rounded-sm animate-[pop-in_0.25s_ease-out] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95 transition-transform ${badgeColor} ${tableStyles} ${isSuccess ? 'shadow-[0_0_10px_rgba(106,170,58,0.2)]' : 'shadow-[0_0_10px_rgba(192,80,80,0.2)]'}`}
      >
        {isSuccess ? '\u2713' : '\u2717'}
        {/* fix: tooltip only on hover, not on focus (aria-label handles a11y) */}
        {isTable ? (
          <span className="absolute -top-5.5 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap bg-tooltip-bg text-tooltip-text px-2 py-0.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
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

  // Test slot: single "Registrar Maximo" button instead of Pass/Fail pair
  if (isTestSlot === true) {
    const testSizeClasses = isTable
      ? 'min-h-[44px] px-3 py-1.5 text-[11px]'
      : 'min-h-[48px] px-3 py-2 text-xs';

    return (
      <button
        onClick={() => onMark(index, tier, 'success')}
        aria-label={`Registrar maximo ${tier}`}
        className={`${testSizeClasses} font-bold border-2 border-accent bg-transparent text-accent rounded-sm cursor-pointer transition-all duration-150 hover:bg-accent/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none whitespace-nowrap`}
      >
        Registrar Maximo
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
        className={`${sizeClasses} font-extrabold border-2 border-ok-ring bg-transparent text-ok rounded-sm cursor-pointer transition-all duration-150 hover:bg-ok-bg hover:shadow-glow-success active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none`}
      >
        &#10003;
      </button>
      <button
        onClick={() => onMark(index, tier, 'fail')}
        aria-label={`Marcar ${tier} fallo`}
        className={`${sizeClasses} font-extrabold border-2 border-fail-ring bg-transparent text-fail rounded-sm cursor-pointer transition-all duration-150 hover:bg-fail-bg hover:shadow-glow-fail active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none`}
      >
        &#10007;
      </button>
    </div>
  );
}
