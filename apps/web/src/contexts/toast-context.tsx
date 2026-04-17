import { createContext, useContext, useRef, useState } from 'react';

interface ToastAction {
  readonly label: string;
  readonly onClick: () => void;
}

type ToastVariant = 'default' | 'pr';

interface Toast {
  readonly id: number;
  readonly message: string;
  readonly action?: ToastAction;
  readonly variant: ToastVariant;
  readonly exiting: boolean;
}

interface ToastOpts {
  readonly message: string;
  readonly action?: ToastAction;
  readonly variant?: ToastVariant;
}

interface ToastContextValue {
  readonly toasts: readonly Toast[];
  readonly toast: (opts: ToastOpts) => void;
  readonly dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 3000;
const PR_DISMISS_MS = 5000;

export function ToastProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactNode {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const nextId = useRef(0);

  const remove = (id: number): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const dismiss = (id: number): void => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => remove(id), 200);
  };

  const toast = (opts: ToastOpts): void => {
    const id = nextId.current++;
    const variant = opts.variant ?? 'default';
    setToasts((prev) => [
      ...prev.slice(-(MAX_TOASTS - 1)),
      { id, message: opts.message, action: opts.action, variant, exiting: false },
    ]);
    setTimeout(() => dismiss(id), variant === 'pr' ? PR_DISMISS_MS : AUTO_DISMISS_MS);
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>{children}</ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
