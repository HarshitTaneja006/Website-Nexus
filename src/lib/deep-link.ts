/**
 * deep-link.ts — client-side builders for the site's shareable deep links.
 * Every important surface is addressable:
 *   ?event=<slug>#events   → RSVP dialog (upcoming) / full brief (past)
 *   #frame-<n>             → gallery lightbox on frame n (1-based)
 *   #scene-<name>          → scroll-flight scene (handled in scroll-flight.tsx)
 */

/** Current origin + pathname without query/hash (safe on the server). */
function siteBase(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

/** Deep link that opens the RSVP/brief dialog for one event. */
export function buildEventDeepLink(slug: string): string {
  return `${siteBase()}?event=${encodeURIComponent(slug)}#events`;
}

/** Deep link that opens the gallery lightbox on a 1-based frame number. */
export function buildFrameDeepLink(frame1: number): string {
  return `${siteBase()}#frame-${frame1}`;
}

/** Replace the URL in history without navigating (keeps back-button clean). */
export function replaceUrl(url: string): void {
  if (typeof window === "undefined") return;
  try {
    window.history.replaceState(null, "", url);
  } catch {
    /* older browsers / sandboxed iframes — non-fatal */
  }
}

/** Strip the `?event=` param while keeping the rest of the URL intact. */
export function stripEventParam(): void {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  u.searchParams.delete("event");
  replaceUrl(u.toString());
}

/** Strip the hash (#frame-N etc.) while keeping query params. */
export function stripHash(): void {
  if (typeof window === "undefined") return;
  replaceUrl(`${window.location.origin}${window.location.pathname}${window.location.search}`);
}
