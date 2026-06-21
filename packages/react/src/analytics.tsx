import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  Analytics,
  AnalyticsEventMap,
  AnalyticsEventName,
  ConsentState,
} from "@openshop/core";

const AnalyticsContext = createContext<Analytics | null>(null);

export interface AnalyticsProviderProps {
  analytics: Analytics;
  children: ReactNode;
}

export function AnalyticsProvider({
  analytics,
  children,
}: AnalyticsProviderProps) {
  return createElement(
    AnalyticsContext.Provider,
    { value: analytics },
    children,
  );
}

export function useAnalytics(): Analytics {
  const analytics = useContext(AnalyticsContext);
  if (!analytics) {
    throw new Error("useAnalytics must be used within an <AnalyticsProvider>.");
  }
  return analytics;
}

/**
 * Publish an analytics event when dependencies change (e.g. on mount for a
 * page view). The event is held until consent allows it.
 */
export function useAnalyticsEffect<N extends AnalyticsEventName>(
  name: N,
  payload: AnalyticsEventMap[N],
  deps: readonly unknown[],
): void {
  const analytics = useAnalytics();
  useEffect(() => {
    analytics.publish(name, payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Read and update consent state reactively. */
export function useConsent(): [ConsentState, (next: Partial<ConsentState>) => void] {
  const analytics = useAnalytics();
  const [consent, setConsentState] = useState<ConsentState>(() =>
    analytics.getConsent(),
  );
  const update = (next: Partial<ConsentState>) => {
    analytics.setConsent(next);
    setConsentState(analytics.getConsent());
  };
  return [consent, update];
}
