import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type TagTone = 'default' | 'gold' | 'ok' | 'fail';

interface TagProps {
  readonly children: ReactNode;
  readonly tone?: TagTone;
  readonly className?: string;
}

const TONE_CLASSES: Record<TagTone, string> = {
  default: 'text-muted border-rule-light',
  gold: 'text-accent border-accent-dim',
  ok: 'text-ok border-ok-ring',
  fail: 'text-fail border-fail-ring',
};

/**
 * Tag — small status pill in the mono meta voice. Tone carries state colour (gold for the
 * scarce signal, ok/fail for outcomes).
 */
export function Tag({ children, tone = 'default', className }: TagProps): ReactNode {
  return (
    <span
      className={cn(
        'inline-block whitespace-nowrap rounded-chip border px-2.5 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
