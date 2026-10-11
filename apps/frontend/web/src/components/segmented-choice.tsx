import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SegmentedOption<Value extends string> {
  readonly value: Value;
  readonly label: ReactNode;
  /** Accessible name when the label is an icon or abbreviated text. */
  readonly ariaLabel?: string;
}

interface SegmentedChoiceProps<Value extends string> {
  readonly label: string;
  readonly value: Value;
  readonly options: readonly SegmentedOption<Value>[];
  readonly onChange: (value: Value) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

/**
 * Radio group rendered as a segmented control. Mirrors the mobile SegmentedChoice: a recessed
 * track, the selected segment solid gold, arrow keys move the selection.
 */
export function SegmentedChoice<Value extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
}: SegmentedChoiceProps<Value>): ReactNode {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (option === undefined) return;
    onChange(option.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex gap-1 rounded-[calc(var(--radius-control)+4px)] border border-rule bg-body p-1',
        className
      )}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'type-button flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 rounded-control px-3 py-2',
              'cursor-pointer transition-[background-color,color,transform] duration-[var(--duration-press)] ease-[var(--ease-press)]',
              'active:translate-y-px focus-visible:ring-2 ring-accent focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-35',
              checked ? 'bg-accent text-on-accent' : 'text-label hover:text-main'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
