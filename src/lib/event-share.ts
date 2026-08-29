/**
 * event-share.ts — client-side helpers for the event cards:
 *  - buildIcs(): RFC 5545 .ics blob so students can add events to any calendar
 *  - shareEvent(): Web Share API with clipboard fallback (terminal-styled toast text)
 *
 * The RFC 5545 primitives live in ics.ts (server-safe) so the site-wide
 * /api/calendar.ics subscription feed renders byte-identical output.
 */

import { buildVCalendar, type IcsEventInput } from "@/lib/ics";

export type IcsEvent = IcsEventInput & { slug?: string };

export function buildIcs(ev: IcsEvent): string {
  return buildVCalendar([ev], {
    name: "NEXUS — VIT Chennai",
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

/**
 * Native share sheet when available; otherwise copy a styled invite line
 * to the clipboard. Returns a toast descriptor for the caller.
 */
export async function shareEvent(
  ev: SharePayload & { slug: string }
): Promise<{ ok: boolean; via: "share" | "clipboard"; message: string }> {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}#events`
      : "#events";
  const text = `▸ ${ev.title} — ${ev.description.slice(0, 120)}\n${url}`;

  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: ev.title, text, url });
      return { ok: true, via: "share", message: `${ev.title} beamed to your share target.` };
    }
    await navigator.clipboard.writeText(text);
    return { ok: true, via: "clipboard", message: "invite copied to clipboard." };
  } catch (err) {
    // AbortError = user dismissed the sheet — not a failure
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, via: "share", message: "share cancelled." };
    }
    // last-ditch: legacy execCommand
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return { ok: true, via: "clipboard", message: "invite copied to clipboard." };
    } catch {
      return { ok: false, via: "clipboard", message: "clipboard blocked by the browser." };
    }
  }
}
