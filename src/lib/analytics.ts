type AnalyticsEvent =
  | 'calculator_view'
  | 'first_interaction'
  | 'input_changed'
  | 'calculate_complete'
  | 'tier_switched'
  | 'export_started'
  | 'export_completed'
  | 'cta_clicked';

interface EventPayload {
  event: AnalyticsEvent;
  properties?: Record<string, string | number | boolean>;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    analytics?: { track: (event: string, props?: Record<string, unknown>) => void };
  }
}

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean>): void {
  if (typeof window === 'undefined') return;

  // Google Analytics 4
  if (window.gtag) {
    window.gtag('event', event, properties);
  }

  // Segment / RudderStack
  if (window.analytics?.track) {
    window.analytics.track(event, properties);
  }

  // Dev logging
  if (import.meta.env.DEV) {
    console.debug('[ROI Analytics]', event, properties);
  }
}
