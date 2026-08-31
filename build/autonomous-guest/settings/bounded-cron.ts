const MAX_LOOKAHEAD_MINUTES = 90 * 24 * 60;

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

type ParsedField = Readonly<{ values: ReadonlySet<number>; wildcard: boolean }>;
type ParsedCron = Readonly<{
  minute: ParsedField;
  hour: ParsedField;
  day: ParsedField;
  month: ParsedField;
  weekday: ParsedField;
}>;

function parseField(source: string, minimum: number, maximum: number, label: string): ParsedField {
  const text = source.trim();
  if (!text) throw new Error(`Autonomous Guest scheduler ${label} cron field is empty.`);
  const values = new Set<number>();
  const wildcard = text === "*";

  for (const segment of text.split(",")) {
    const [rangeText, stepText] = segment.split("/");
    if (!rangeText || segment.split("/").length > 2) throw new Error(`Autonomous Guest scheduler ${label} cron field is invalid.`);
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1 || step > maximum - minimum + 1) {
      throw new Error(`Autonomous Guest scheduler ${label} cron step is invalid.`);
    }

    let start: number;
    let end: number;
    if (rangeText === "*") {
      start = minimum;
      end = maximum;
    } else if (rangeText.includes("-")) {
      const [startText, endText] = rangeText.split("-");
      start = Number(startText);
      end = Number(endText);
    } else {
      start = Number(rangeText);
      end = start;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < minimum || end > maximum || start > end) {
      throw new Error(`Autonomous Guest scheduler ${label} cron range is invalid.`);
    }
    for (let value = start; value <= end; value += step) values.add(value);
  }

  if (!values.size) throw new Error(`Autonomous Guest scheduler ${label} cron field has no values.`);
  return Object.freeze({ values, wildcard });
}

export function parseAutonomousGuestBoundedCron(cron: string): ParsedCron {
  const fields = String(cron || "").trim().split(/\s+/);
  if (fields.length !== 5) throw new Error("Autonomous Guest scheduler supports bounded five-field cron expressions.");
  return Object.freeze({
    minute: parseField(fields[0]!, 0, 59, "minute"),
    hour: parseField(fields[1]!, 0, 23, "hour"),
    day: parseField(fields[2]!, 1, 31, "day-of-month"),
    month: parseField(fields[3]!, 1, 12, "month"),
    weekday: parseField(fields[4]!, 0, 6, "day-of-week"),
  });
}

function zonedParts(timestamp: number, timezone?: string) {
  const date = new Date(timestamp);
  if (!timezone || timezone === "UTC") {
    return {
      minute: date.getUTCMinutes(),
      hour: date.getUTCHours(),
      day: date.getUTCDate(),
      month: date.getUTCMonth() + 1,
      weekday: date.getUTCDay(),
    };
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = WEEKDAYS[String(parts.weekday || "")];
  if (weekday === undefined) throw new Error("Autonomous Guest scheduler could not resolve the requested timezone.");
  return {
    minute: Number(parts.minute),
    hour: Number(parts.hour),
    day: Number(parts.day),
    month: Number(parts.month),
    weekday,
  };
}

function matches(parsed: ParsedCron, timestamp: number, timezone?: string) {
  const parts = zonedParts(timestamp, timezone);
  const dayMatches = parsed.day.values.has(parts.day);
  const weekdayMatches = parsed.weekday.values.has(parts.weekday);
  const calendarDayMatches = parsed.day.wildcard
    ? weekdayMatches
    : parsed.weekday.wildcard
      ? dayMatches
      : dayMatches || weekdayMatches;
  return parsed.minute.values.has(parts.minute)
    && parsed.hour.values.has(parts.hour)
    && parsed.month.values.has(parts.month)
    && calendarDayMatches;
}

export function nextAutonomousGuestBoundedCronFireAt(cron: string, timezone: string | undefined, after: number) {
  const parsed = parseAutonomousGuestBoundedCron(cron);
  if (!Number.isFinite(after) || after < 0) throw new Error("Autonomous Guest scheduler cron reference time is invalid.");
  if (timezone && timezone.length > 100) throw new Error("Autonomous Guest scheduler timezone is too long.");
  const start = Math.floor(after / 60_000) * 60_000 + 60_000;
  for (let offset = 0; offset < MAX_LOOKAHEAD_MINUTES; offset += 1) {
    const candidate = start + offset * 60_000;
    if (matches(parsed, candidate, timezone)) return candidate;
  }
  throw new Error("Autonomous Guest scheduler cron has no bounded occurrence in the next 90 days.");
}
