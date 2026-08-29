/**
 * ics.ts — RFC 5545 building blocks, server-safe (no window/DOM).
 * Shared by the client-side per-event .ics downloader (event-share.ts)
 * and the site-wide /api/calendar.ics subscription feed.
 */

export interface IcsEventInput {
  uid: string;
  title: string;
  description: string;
  venue: string;
  startsAt: string; // ISO
  endsAt: string | null; // ISO
  url?: string;
}

/** ISO → ICS UTC "YYYYMMDDTHHMMSSZ" */
export function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** RFC 5545 requires escaping commas, semicolons and newlines in text fields. */
export function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold long lines at 75 octets per RFC 5545 §3.1. */
export function foldIcsLine(line: string): string {
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

/** One VALARM display reminder. */
function buildValarm(minutesBefore: number, title: string, venue: string): string {
  const desc =
    minutesBefore >= 1440
      ? `[NEXUS] "${title}" starts tomorrow — ${venue}`
      : `[NEXUS] "${title}" starts in ${minutesBefore} min — ${venue}`;
  return [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    foldIcsLine(`DESCRIPTION:${icsEscape(desc)}`),
    foldIcsLine(`TRIGGER:-P${minutesBefore >= 1440 ? "1D" : `T${minutesBefore}M`}`),
    "END:VALARM",
  ].join("\r\n");
}

/** One VEVENT block (with two display reminders: 24h and 60m before — upcoming events only). */
export function buildVEvent(ev: IcsEventInput, calName: string): string {
  const dtstamp = icsDate(new Date().toISOString());
  const dtstart = icsDate(ev.startsAt);
  // default to a 2-hour block when no explicit end
  const dtend = ev.endsAt
    ? icsDate(ev.endsAt)
    : icsDate(new Date(new Date(ev.startsAt).getTime() + 2 * 3600_000).toISOString());

  const lines = [
    "BEGIN:VEVENT",
    foldIcsLine(`UID:${ev.uid}@nexus.vitc`),
    foldIcsLine(`DTSTAMP:${dtstamp}`),
    foldIcsLine(`DTSTART:${dtstart}`),
    foldIcsLine(`DTEND:${dtend}`),
    foldIcsLine(`SUMMARY:${icsEscape(ev.title)}`),
    foldIcsLine(`LOCATION:${icsEscape(ev.venue)}`),
    foldIcsLine(`DESCRIPTION:${icsEscape(ev.description)}`),
    foldIcsLine(`CATEGORIES:${icsEscape(calName)}`),
  ];
  if (ev.url) lines.push(foldIcsLine(`URL:${ev.url}`));
  if (new Date(ev.startsAt).getTime() > Date.now()) {
    lines.push(buildValarm(1440, ev.title, ev.venue));
    lines.push(buildValarm(60, ev.title, ev.venue));
  }
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

/** Full VCALENDAR document around one or more VEVENTs. */
export function buildVCalendar(
  events: IcsEventInput[],
  opts: { name: string; description?: string }
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NEXUS VITC//Transmit Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldIcsLine(`X-WR-CALNAME:${icsEscape(opts.name)}`),
  ];
  if (opts.description) {
    lines.push(foldIcsLine(`X-WR-CALDESC:${icsEscape(opts.description)}`));
  }
  lines.push(
    events.map((ev) => buildVEvent(ev, opts.name)).join("\r\n"),
    "END:VCALENDAR"
  );
  return lines.join("\r\n");
}
