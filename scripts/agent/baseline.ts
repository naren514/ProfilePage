/**
 * Agent baseline (agent PRD A0): the five success metrics for a database.
 *
 *   DATABASE_URL=postgres://… npm run agent:baseline              # last 90 days
 *   DATABASE_URL=postgres://… npm run agent:baseline -- --days 30
 *
 * Prints a Markdown table (paste it into docs/writing-studio/agent-baseline.md).
 * Read-only.
 */
import { agentMetrics } from "../../src/lib/agent/metrics-data";
import { meetsTarget, TARGETS, type AgentMetrics } from "../../src/lib/agent/metrics";

export function baselineMarkdown(m: AgentMetrics, days: number, when = new Date()): string {
  const keys = Object.keys(TARGETS) as Array<keyof typeof TARGETS>;
  const rows = keys.map((k) => {
    const r = m[k];
    const t = TARGETS[k];
    const ok = meetsTarget(k, r);
    const now = r.value === null ? "no data" : `${Math.round(r.value * 1000) / 10}% (${r.numerator}/${r.denominator})`;
    return `| ${t.label} | ${now} | ${t.op === ">=" ? "≥" : "≤"} ${t.value * 100}% | ${ok === null ? "—" : ok ? "on target" : "below target"} |`;
  });
  return [
    `Measured ${when.toISOString().slice(0, 10)} over the last ${days} days (${m.runs} runs).`,
    "",
    "| Metric | Baseline | Target | |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

async function main() {
  const i = process.argv.indexOf("--days");
  const days = i > 0 ? Math.max(1, Number(process.argv[i + 1]) || 90) : 90;
  const metrics = await agentMetrics(days);
  console.log(baselineMarkdown(metrics, days));
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
