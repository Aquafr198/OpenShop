/**
 * Analytics transport to Shopify's Monorail ingestion endpoint.
 *
 * Best-effort and fire-and-forget: a transport failure must never affect the
 * storefront. Prefers `navigator.sendBeacon` (survives page unload), falls back
 * to `fetch({ keepalive: true })`, then to a no-op when neither is available.
 *
 * Note: the Monorail `schema_id` values are a Shopify-internal contract that
 * isn't fully documented and may change across versions, so they're
 * configurable (with sensible defaults) rather than hardcoded blindly.
 */

export interface MonorailEvent {
  schema_id: string;
  payload: Record<string, unknown>;
}

export interface AnalyticsTransport {
  /** Send a batch of events. Resolves even on failure (never throws/rejects). */
  send(events: MonorailEvent[]): Promise<void>;
}

export interface MonorailTransportOptions {
  /** Override the Monorail endpoint (useful for tests). */
  endpoint?: string;
  /** Inject a fetch implementation (defaults to global fetch). */
  fetch?: typeof fetch;
  /**
   * Disable `navigator.sendBeacon` even when present (e.g. to force fetch in
   * tests). Default false.
   */
  disableBeacon?: boolean;
}

const DEFAULT_ENDPOINT =
  "https://monorail-edge.shopifysvc.com/unstable/produce_batch";

function nowMs(): number {
  return Date.now();
}

function buildBody(events: MonorailEvent[]): string {
  const sentAt = nowMs();
  return JSON.stringify({
    events: events.map((event) => ({
      schema_id: event.schema_id,
      payload: event.payload,
      metadata: { event_created_at_ms: sentAt, event_sent_at_ms: sentAt },
    })),
    metadata: { event_sent_at_ms: sentAt },
  });
}

export function createMonorailTransport(
  options: MonorailTransportOptions = {},
): AnalyticsTransport {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  return {
    async send(events: MonorailEvent[]): Promise<void> {
      if (events.length === 0) return;
      const body = buildBody(events);

      // 1) Prefer sendBeacon in the browser (survives navigation/unload).
      if (
        !options.disableBeacon &&
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        try {
          const blob = new Blob([body], { type: "text/plain" });
          if (navigator.sendBeacon(endpoint, blob)) return;
        } catch {
          // fall through to fetch
        }
      }

      // 2) Fall back to fetch with keepalive.
      if (typeof fetchImpl === "function") {
        try {
          await fetchImpl(endpoint, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body,
            keepalive: true,
          });
        } catch {
          // Best-effort: swallow transport errors.
        }
        return;
      }

      // 3) No transport available: no-op.
    },
  };
}
