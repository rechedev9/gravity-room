import { describe, it, expect } from 'bun:test';
import { render } from '@testing-library/react';
import { ToastContainer } from './toast';
import { ToastProvider, useToast } from '@/contexts/toast-context';
import { useEffect } from 'react';

// ---------------------------------------------------------------------------
// Toast — hero-number-glow class assertions (REQ-TOAST-001, REQ-TOAST-002)
// ---------------------------------------------------------------------------

/**
 * Helper: renders a ToastProvider + ToastContainer and fires a toast
 * with the given variant via a child component.
 */
function ToastTrigger({
  message,
  variant,
}: {
  readonly message: string;
  readonly variant?: 'pr' | 'default';
}): null {
  const { toast } = useToast();
  useEffect(() => {
    toast({ message, variant });
  }, []);
  return null;
}

function ToastTriggerWithAction({
  message,
  actionLabel,
}: {
  readonly message: string;
  readonly actionLabel: string;
}): null {
  const { toast } = useToast();
  useEffect(() => {
    toast({ message, action: { label: actionLabel, onClick: () => {} } });
  }, []);
  return null;
}

function renderWithToast(message: string, variant?: 'pr' | 'default'): ReturnType<typeof render> {
  return render(
    <ToastProvider>
      <ToastTrigger message={message} variant={variant} />
      <ToastContainer />
    </ToastProvider>
  );
}

describe('ToastContainer', () => {
  describe('PR variant glow class (REQ-TOAST-001, REQ-TOAST-002)', () => {
    it('should add hero-number-glow class to PR toast text span', () => {
      renderWithToast('Sentadilla 60 kg', 'pr');

      const span = document.querySelector('.hero-number-glow');

      expect(span).not.toBeNull();
    });

    it('should NOT add hero-number-glow to standard (default) toast text span', () => {
      renderWithToast('Éxito en T1', 'default');

      const span = document.querySelector('.hero-number-glow');

      expect(span).toBeNull();
    });

    it('should NOT add hero-number-glow to toast without explicit variant (defaults to default)', () => {
      renderWithToast('Simple message');

      const span = document.querySelector('.hero-number-glow');

      expect(span).toBeNull();
    });

    it('should display PR message text with NUEVO PR prefix', () => {
      renderWithToast('Sentadilla 60 kg', 'pr');

      const span = document.querySelector('.hero-number-glow');

      expect(span?.textContent).toContain('NUEVO PR');
      expect(span?.textContent).toContain('Sentadilla 60 kg');
    });
  });

  describe('PR toast text format (REQ-CCF-001)', () => {
    it('should render full text NUEVO PR — Sentadilla 100 kg for PR variant', () => {
      renderWithToast('Sentadilla 100 kg', 'pr');

      const span = document.querySelector('.hero-number-glow');

      expect(span?.textContent).toBe('NUEVO PR — Sentadilla 100 kg');
    });
  });

  describe('close button (C-6)', () => {
    it('should render a close button with aria-label "Cerrar notificación"', () => {
      renderWithToast('Test message');

      const closeBtn = document.querySelector('[aria-label="Cerrar notificación"]');

      expect(closeBtn).not.toBeNull();
    });
  });

  describe('action button tap target (C-6)', () => {
    it('should have min-h-[44px] class on action button', () => {
      render(
        <ToastProvider>
          <ToastTriggerWithAction message="Undo test" actionLabel="Deshacer" />
          <ToastContainer />
        </ToastProvider>
      );

      const actionBtn = document.querySelector('button.min-h-\\[44px\\]');

      expect(actionBtn).not.toBeNull();
      expect(actionBtn?.textContent).toBe('Deshacer');
    });
  });

  describe('safe-area inset (REQ-CCF-004)', () => {
    it('should set paddingBottom containing env(safe-area-inset-bottom) on the container', () => {
      // happy-dom strips unsupported CSS functions like env(), so we intercept
      // the style.setProperty calls to capture what React tried to set.
      const capturedStyles: Array<{ property: string; value: string }> = [];
      const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty = function (
        prop: string,
        value: string,
        priority?: string
      ): void {
        capturedStyles.push({ property: prop, value });
        originalSetProperty.call(this, prop, value, priority ?? '');
      };

      try {
        renderWithToast('Test message');

        const paddingSet = capturedStyles.find(
          (s) => s.property === 'padding-bottom' && s.value.includes('env(safe-area-inset-bottom)')
        );

        expect(paddingSet).toBeDefined();
      } finally {
        CSSStyleDeclaration.prototype.setProperty = originalSetProperty;
      }
    });
  });
});
