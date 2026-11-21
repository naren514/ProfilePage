/**
 * Record web fixtures for the agent eval (agent PRD A0) from real Tavily
 * searches, so eval runs replay the same results and only the model varies.
 *
 *   npm run agent:record -- --set supply-chain-w48 --query "nearshoring freight lanes 2026" --query "EDI outage post-mortem"
 *   … add --yes to spend (one search per query, about $0.016 each)
 *
 * Writes tests/agent-eval/fixtures/web/<set>/search.json with the combined
 * results as "default" plus one entry per normalized query. Review the file
 * before committing it: it's public web text.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { isSearchConfigured, tavilySearch } from "../../src/lib/agent/tavily";

const PRICE_PER_SEARCH = 0.016;

function parse(argv: string[]) {
  const out = { set: "", queries: [] as string[], yes: false, max: 5 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--set") out.set = argv[++i];
    else if (argv[i] === "--query") out.queries.push(argv[++i]);
    else if (argv[i] === "--max") out.max = Number(argv[++i]);
    else if (argv[i] === "--yes") out.yes = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!/^[a-z0-9-]+$/.test(out.set)) throw new Error("--set needs a name like supply-chain-w48");
  if (out.queries.length === 0) throw new Error("Pass at least one --query");
  return out;
}

async function main() {
  const a = parse(process.argv.slice(2));
  console.log(`${a.queries.length} search(es) into set "${a.set}", about $${(a.queries.length * PRICE_PER_SEARCH).toFixed(3)}.`);
  if (!a.yes) return console.log("Add --yes to run them.");
  if (!isSearchConfigured()) throw new Error("Set TAVILY_API_KEY.");
  const byQuery: Record<string, unknown[]> = {};
  const all: Array<{ url: string }> = [];
  for (const q of a.queries) {
    const results = await tavilySearch(q, { maxResults: a.max });
    const rows = results.map((r) => ({ title: r.title, url: r.url, content: r.content, score: r.score, published_date: r.publishedDate }));
    byQuery[q.toLowerCase().replace(/\s+/g, " ").trim()] = rows;
    for (const r of rows) if (!all.some((x) => x.url === r.url)) all.push(r);
  }
  const dir = resolve(__dirname, "../../tests/agent-eval/fixtures/web", a.set);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "search.json"), JSON.stringify({ default: all, ...byQuery }, null, 2) + "\n");
  console.log(`Wrote ${all.length} results to ${dir}/search.json`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
