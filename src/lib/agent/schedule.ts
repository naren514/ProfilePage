import { CronExpressionParser } from "cron-parser";

// Pure schedule helpers for triggers (agent PRD A1), unit tested.

/** The next time a 5-field cron expression fires after `after`, in `timezone`. */
export function nextRunAt(schedule: string, timezone: string, after: Date): Date {
  return CronExpressionParser.parse(schedule, { currentDate: after, tz: timezone }).next().toDate();
}

/** Throws a readable error for an invalid expression or time zone. */
export function validateSchedule(schedule: string, timezone: string): void {
  if (schedule.trim().split(/\s+/).length !== 5) throw new Error("Use a 5-field schedule: minute hour day-of-month month day-of-week.");
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new Error(`Unknown time zone "${timezone}".`);
  }
  try {
    nextRunAt(schedule, timezone, new Date());
  } catch (error) {
    throw new Error(`That schedule isn't valid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Midnight today in `timezone`, as a UTC instant (for per-trigger daily caps). */
export function startOfLocalDay(timezone: string, now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const sinceMidnightMs = ((get("hour") * 60 + get("minute")) * 60 + get("second")) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - sinceMidnightMs);
}

/** A short human description of common schedules ("Every day at 2:00 am"). */
export function describeSchedule(schedule: string): string {
  const f = schedule.trim().split(/\s+/);
  if (f.length !== 5) return schedule;
  const [min, hour, dom, mon, dow] = f;
  const time = /^\d+$/.test(min) && /^\d+$/.test(hour) ? new Date(Date.UTC(2000, 0, 1, Number(hour), Number(min))).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).toLowerCase() : null;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  if (time && dom === "*" && mon === "*" && dow === "*") return `Every day at ${time}`;
  if (time && dom === "*" && mon === "*" && /^[0-6]$/.test(dow)) return `Every ${days[Number(dow)]} at ${time}`;
  if (time && dom === "*" && mon === "*" && dow === "1-5") return `Weekdays at ${time}`;
  if (/^\d+$/.test(min) && hour === "*" && dom === "*" && mon === "*" && dow === "*") return `Every hour at :${min.padStart(2, "0")}`;
  return schedule;
}

/** Replace {{name}} in every string of a template with values from `vars`. */
export function renderTemplate<T>(template: T, vars: Record<string, string>): T {
  if (typeof template === "string") return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m)) as T;
  if (Array.isArray(template)) return template.map((x) => renderTemplate(x, vars)) as T;
  if (template && typeof template === "object") {
    return Object.fromEntries(Object.entries(template).map(([k, v]) => [k, renderTemplate(v, vars)])) as T;
  }
  return template;
}
