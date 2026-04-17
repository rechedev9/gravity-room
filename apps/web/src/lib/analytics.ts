type AnalyticsEvent =
  | 'signup'
  | 'guest_start'
  | 'program_start'
  | 'program_complete'
  | 'landing_view'
  | 'landing_cta_click'
  | 'program_preview_view'
  | 'login_page_view';

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

/**
 * Reads UTM parameters from the current URL.
 * Returns only the params that are present — omits undefined values.
 */
export function getUtmProps(): Readonly<Record<string, string>> {
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
  for (const key of keys) {
    const val = params.get(key);
    if (val !== null && val !== '') {
      result[key] = val;
    }
  }
  return result;
}
