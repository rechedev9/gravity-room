type AnalyticsEvent = 'signup' | 'guest_start' | 'program_start' | 'program_complete';

declare global {
  interface Window {
    readonly plausible?: (
      event: string,
      options?: { readonly props?: Readonly<Record<string, string | number | boolean>> }
    ) => void;
  }
}

export function trackEvent(
  event: AnalyticsEvent,
  props?: Readonly<Record<string, string | number | boolean>>
): void {
  window.plausible?.(event, props ? { props } : undefined);
}
