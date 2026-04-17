import { createPortal } from 'react-dom';
import { useToast } from '@/contexts/toast-context';

const PR_TOAST_PREFIX = 'NUEVO PR';

export function ToastContainer(): React.ReactNode {
  const { toasts, dismiss } = useToast();

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none"
      style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
    >
      {toasts.map((t) => {
        const animation = t.exiting
          ? 'animate-[fadeSlideDown_0.2s_ease-out_forwards]'
          : 'animate-[fadeSlideUp_0.2s_ease-out]';
        const variantStyle =
          t.variant === 'pr'
            ? 'bg-changed text-title border-2 border-accent'
            : 'bg-header text-title border border-rule';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 text-xs font-bold shadow-elevated ${animation} ${variantStyle}`}
          >
            <span className={t.variant === 'pr' ? 'hero-number-glow' : undefined}>
              {t.variant === 'pr' ? `${PR_TOAST_PREFIX} — ${t.message}` : t.message}
            </span>
            {t.action && (
              <button
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="min-h-[44px] py-2 px-3 flex items-center text-accent font-bold underline cursor-pointer bg-transparent border-none text-xs whitespace-nowrap"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted hover:text-title bg-transparent border-none cursor-pointer transition-colors"
              aria-label="Cerrar notificación"
            >
              &#10005;
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
