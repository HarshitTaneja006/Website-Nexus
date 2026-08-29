/**
 * event-share.ts — client-side helpers for the event cards:
 *  - buildIcs(): RFC 5545 .ics blob so students can add events to any calendar
 *  - shareEvent(): Web Share API with clipboard fallback (terminal-styled toast text)
 */

export interface IcsEvent {
  uid: string;
  title: string;
  description: string;
  venue: string;
  startsAt: string; // ISO
  endsAt: string | null; // ISO
}

/** ISO → ICS UTC "YYYYMMDDTHHMMSSZ" */
function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** RFC 5545 requires escaping commas, semicolons and newlines in text fields. */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold long lines at 75 octets per RFC 5545 §3.1. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return parts.join("\r\n");
}

export function buildIcs(ev: IcsEvent): string {
  const dtstamp = icsDate(new Date().toISOString());
  const dtstart = icsDate(ev.startsAt);
  // default to a 2-hour block when no explicit end
  const dtend = ev.endsAt
    ? icsDate(ev.endsAt)
    : icsDate(new Date(new Date(ev.startsAt).getTime() + 2 * 3600_000).toISOString());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NEXUS VITC//Transmit Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    fold(`UID:${ev.uid}@nexus.vitc`),
    fold(`DTSTAMP:${dtstamp}`),
    fold(`DTSTART:${dtstart}`),
    fold(`DTEND:${dtend}`),
    fold(`SUMMARY:${esc(ev.title)}`),
    fold(`LOCATION:${esc(ev.venue)}`),
    fold(`DESCRIPTION:${esc(ev.description)}`),
    fold(`URL:${typeof window !== "undefined" ? window.location.origin + "#events" : "#events"}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
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
