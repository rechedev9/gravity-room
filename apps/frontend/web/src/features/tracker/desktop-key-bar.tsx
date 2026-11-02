import { useTranslation } from 'react-i18next';
import { Kbd } from '@/components/ui/kbd';

const HINTS = [
  { keys: 'Enter', labelKey: 'tracker.key_bar.confirm' },
  { keys: '↑↓', labelKey: 'tracker.key_bar.reps' },
  { keys: '← →', labelKey: 'tracker.key_bar.day' },
  { keys: 'U', labelKey: 'tracker.key_bar.undo' },
  { keys: 'Espacio', labelKey: 'tracker.key_bar.rest' },
] as const;

/**
 * Fixed key bar for the lg+ tracker (artboard S8). It is the permanent, always
 * visible version of the keyboard model, so the lifter never has to remember it.
 * Below lg the same hints stay in the session side panel.
 */
export function DesktopKeyBar(): React.ReactNode {
  const { t } = useTranslation();
  return (
    <div
      data-testid="session-key-bar"
      className="fixed bottom-0 right-0 left-[var(--sidebar-width)] z-20 hidden justify-center border-t border-rule bg-header/95 px-4 py-2 backdrop-blur lg:flex"
    >
      <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] text-label">
        {HINTS.map((hint) => (
          <li key={hint.keys} className="flex items-center gap-1.5">
            <Kbd>{hint.keys}</Kbd>
            <span>{t(hint.labelKey)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
