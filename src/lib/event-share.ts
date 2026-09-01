/**
 * event-share.ts - client-side helpers for the event cards:
 *  - buildIcs(): RFC 5545 .ics blob so students can add events to any calendar
 *  - shareEvent(): Web Share API → clipboard API → execCommand → manual-copy
 *    payload. Every failure mode degrades; the caller can never crash.
 *
 * The RFC 5545 primitives live in ics.ts (server-safe) so the site-wide
 * /api/calendar.ics subscription feed renders byte-identical output.
 */

import { buildVCalendar, type IcsEventInput } from "@/lib/ics";
import { buildEventDeepLink } from "@/lib/deep-link";

export type IcsEvent = IcsEventInput & { slug?: string };

export function buildIcs(ev: IcsEvent): string {
  return buildVCalendar([ev], {
    name: "NEXUS - VIT Chennai",
    description: "Single event transmit from the NEXUS schedule",
  });
}

export function downloadIcs(ev: IcsEvent): void {
  const blob = new Blob([buildIcs(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ev.slug || "nexus-event"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export interface SharePayload {
  title: string;
  description: string;
}

export interface ShareResult {
  ok: boolean;
  via: "share" | "clipboard" | "manual";
  message: string;
  /**
   * The composed invite line - returned ONLY when every programmatic
   * write path is blocked (cross-origin iframes / restricted webviews).
   * The caller should open a manual-copy panel with it; our own DOM is
   * the one copy channel no permissions policy can take away.
   */
  text?: string;
}

/** The exact invite text shared/copied, so callers can render it for manual copy. */
export function buildShareText(ev: SharePayload & { slug: string }): string {
  const url = buildEventDeepLink(ev.slug);
  return `▸ ${ev.title} - ${ev.description.slice(0, 120)}\n${url}`;
}

/**
 * Last-ditch legacy copy. Runs synchronously inside the click's user
 * activation: focus + select the textarea, then execCommand. Returns
 * false (never throws) when the engine refuses.
 */
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", ""); // avoid mobile keyboards popping open
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    ta.remove();
    active?.focus();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Native share sheet when available; otherwise copy a styled invite line
 * to the clipboard. Returns a toast descriptor for the caller.
 * The shared URL is a true deep link (?event=slug#events) - opening it
 * scrolls to the schedule and pre-opens this event's dialog.
 *
 * Hardened for restricted contexts (preview iframes, kiosk webviews):
 * a rejected navigator.share is NOT terminal - it falls through to the
 * clipboard stages, and if those are permission-blocked too the full
 * invite text comes back via `text` for a manual-copy panel.
 */
export async function shareEvent(
  ev: SharePayload & { slug: string }
): Promise<ShareResult> {
  const text = buildShareText(ev);
  const url = buildEventDeepLink(ev.slug);

  // 1) native share sheet - iframes without the `share` permission get
  //    NotAllowedError (share may still be DEFINED there), so failure
  //    must continue down the chain, not surface as an error.
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const data: ShareData = { title: ev.title, text, url };
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (typeof nav.canShare !== "function" || nav.canShare(data)) {
        await navigator.share(data);
        return { ok: true, via: "share", message: `${ev.title} beamed to your share target.` };
      }
    } catch (err) {
      // AbortError = user dismissed the sheet - not a failure
      if (err instanceof DOMException && err.name === "AbortError") {
        return { ok: false, via: "share", message: "share cancelled." };
      }
      // NotAllowedError / SecurityError → fall through to the clipboard
    }
  }

  // 2) async clipboard API (secure contexts; permission-blocked in
  //    cross-origin iframes → NotAllowedError)
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return { ok: true, via: "clipboard", message: "invite copied to clipboard." };
    }
  } catch {
    /* fall through */
  }

  // 3) legacy execCommand within the same user activation
  if (legacyCopy(text)) {
    return { ok: true, via: "clipboard", message: "invite copied to clipboard." };
  }

  // 4) every programmatic path is blocked - hand back the invite text so
  //    the UI can offer an always-works manual copy panel.
  return { ok: false, via: "manual", message: "clipboard blocked - copy manually.", text };
}
