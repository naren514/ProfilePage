import { describe, expect, it } from "vitest";
import { describeSchedule, nextRunAt, renderTemplate, startOfLocalDay, validateSchedule } from "@/lib/agent/schedule";
import { driverKind } from "@/lib/agent/driver";
import { aiSettingsSchema, defaultAiSettings } from "@/lib/writing/ai/config";

const LA = "America/Los_Angeles";

describe("trigger schedules", () => {
  it("finds the next nightly slot in the trigger's time zone", () => {
    // 01:00 Pacific on Nov 21 → 02:00 Pacific (10:00 UTC) the same night
    expect(nextRunAt("0 2 * * *", LA, new Date("2026-11-21T09:00:00Z")).toISOString()).toBe("2026-11-21T10:00:00.000Z");
    // Just after the slot → the next night
    expect(nextRunAt("0 2 * * *", LA, new Date("2026-11-21T10:00:01Z")).toISOString()).toBe("2026-11-22T10:00:00.000Z");
  });

  it("handles daylight saving changes", () => {
    // Summer: 2 am PDT is 09:00 UTC
    expect(nextRunAt("0 2 * * *", LA, new Date("2026-07-01T00:00:00Z")).toISOString()).toBe("2026-07-01T09:00:00.000Z");
    // Spring forward: 2 am doesn't exist on Mar 8, 2026; it still runs once that day
    const d = nextRunAt("0 2 * * *", LA, new Date("2026-03-08T05:00:00Z"));
    expect(d.toISOString().slice(0, 10)).toBe("2026-03-08");
  });

  it("finds weekly slots", () => {
    // Every Monday at 7 am Pacific; Nov 21, 2026 is a Saturday
    expect(nextRunAt("0 7 * * 1", LA, new Date("2026-11-21T12:00:00Z")).toISOString()).toBe("2026-11-23T15:00:00.000Z");
  });

  it("rejects bad schedules and time zones with a readable message", () => {
    expect(() => validateSchedule("every night", LA)).toThrow(/5-field/);
    expect(() => validateSchedule("0 25 * * *", LA)).toThrow(/isn't valid/);
    expect(() => validateSchedule("0 2 * * *", "Mars/Olympus")).toThrow(/time zone/);
    expect(() => validateSchedule("0 2 * * *", LA)).not.toThrow();
  });

  it("starts the day at local midnight (for daily caps)", () => {
    // 01:30 UTC Nov 22 is 17:30 Nov 21 in Los Angeles → local midnight is 08:00 UTC Nov 21
    expect(startOfLocalDay(LA, new Date("2026-11-22T01:30:00Z")).toISOString()).toBe("2026-11-21T08:00:00.000Z");
  });

  it("describes common schedules in words", () => {
    expect(describeSchedule("0 2 * * *")).toBe("Every day at 2:00 am");
    expect(describeSchedule("0 7 * * 1")).toBe("Every Monday at 7:00 am");
    expect(describeSchedule("30 6 * * 1-5")).toBe("Weekdays at 6:30 am");
    expect(describeSchedule("*/15 * * * *")).toBe("*/15 * * * *");
  });

  it("fills goal and input templates", () => {
    expect(renderTemplate({ itemIds: ["{{itemId}}"], note: "since {{since}} ({{unknown}})", n: 3 }, { itemId: "abc", since: "Monday" })).toEqual({
      itemIds: ["abc"],
      note: "since Monday ({{unknown}})",
      n: 3,
    });
  });
});

describe("agent drivers and the kill switch", () => {
  it("defaults to Vercel Workflow and accepts the fallbacks", () => {
    const before = process.env.AGENT_DRIVER;
    delete process.env.AGENT_DRIVER;
    expect(driverKind()).toBe("workflow");
    process.env.AGENT_DRIVER = "inline";
    expect(driverKind()).toBe("inline");
    process.env.AGENT_DRIVER = "nonsense";
    expect(driverKind()).toBe("workflow");
    if (before === undefined) delete process.env.AGENT_DRIVER;
    else process.env.AGENT_DRIVER = before;
  });

  it("agents are on by default, and older saved settings without the switch stay on", () => {
    expect(defaultAiSettings().agentsEnabled).toBe(true);
    const { agentsEnabled: _, ...older } = defaultAiSettings();
    expect(aiSettingsSchema.parse(older).agentsEnabled).toBe(true);
    expect(aiSettingsSchema.parse({ ...older, agentsEnabled: false }).agentsEnabled).toBe(false);
  });
});
