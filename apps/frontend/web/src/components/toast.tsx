import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useToast, useToastState } from '@/contexts/toast-context';

export function ToastContainer(): React.ReactNode {
  const { t } = useTranslation();
  const toasts = useToastState();
  const { dismiss } = useToast();

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none"
      style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
    >
      {toasts.map((toast) => {
        const animation = toast.exiting
          ? 'animate-[fadeSlideDown_0.2s_ease-out_forwards]'
          : 'animate-slate-drop';
        const variantStyle =
          toast.variant === 'pr'
            ? 'bg-victory text-victory-on border-[1.5px] border-victory shadow-[var(--shadow-victory)]'
            : 'bg-header text-title border border-rule';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 text-xs font-bold shadow-elevated ${animation} ${variantStyle}`}
          >
            <span className={toast.variant === 'pr' ? 'hero-number-glow' : undefined}>
              {toast.variant === 'pr' ? `${t('toast.new_pr')}: ${toast.message}` : toast.message}
            </span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
                className="min-h-[44px] py-2 px-3 flex items-center text-accent font-bold underline cursor-pointer bg-transparent border-none text-xs whitespace-nowrap"
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(toast.id)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted hover:text-title bg-transparent border-none cursor-pointer transition-colors"
              aria-label={t('toast.close_notification')}
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
