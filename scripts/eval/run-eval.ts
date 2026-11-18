/**
 * Writing Studio evaluation harness (PRD §18).
 *
 * Runs the 40 benchmark cases in tests/eval/cases.json through the Studio's
 * real prompts, schemas and validation, for one or two models, and writes a
 * blind side-by-side rating page.
 *
 *   npm run eval -- --model gpt-6.2-sol                      # dry run: shows the plan
 *   npm run eval -- --model gpt-6.2-sol --yes                # run it
 *   npm run eval -- --model gpt-6.2-sol --model llama3.3@http://localhost:11434/v1 --yes
 *   npm run eval -- --model X --only clarity,critique --yes
 *
 * A model is "id" (OpenAI, uses OPENAI_API_KEY and OPENAI_BASE_URL if set) or
 * "id@base-url" for any OpenAI-compatible server (Ollama, vLLM; EVAL_API_KEY
 * is sent if set). Output goes to eval-results/<timestamp>/ (gitignored):
 * results.json and rating.html (open it in a browser and rate).
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

// Workflow modules import the database client; the harness never uses it.
process.env.DATABASE_URL ||= "postgresql://eval@localhost:1/unused";

interface Args {
  models: string[];
  only: string[] | null;
  cases: string;
  out: string;
  yes: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { models: [], only: null, cases: "tests/eval/cases.json", out: "eval-results", yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--model") args.models.push(argv[++i]);
    else if (a === "--only") args.only = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--cases") args.cases = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--yes") args.yes = true;
    else if (a === "--help" || a === "-h") {
      console.log(readFileSync(__filename, "utf8").split("*/")[0]);
      process.exit(0);
    } else throw new Error(`Unknown argument: ${a}`);
  }
  if (args.models.length < 1 || args.models.length > 2) throw new Error("Pass one or two --model arguments.");
  return args;
}

type Case = {
  id: string;
  category: "clarity" | "concise" | "brainstorm" | "outline" | "draft" | "critique" | "research";
  operation?: "improve" | "shorten";
  passage?: string;
  idea?: string;
  direction?: Record<string, string>;
  notes?: string;
  length?: "short" | "medium" | "long";
  document?: string;
  question?: string;
  sources?: Array<{ title: string; url: string; content: string }>;
};

interface Output {
  caseId: string;
  category: string;
  model: string;
  ok: boolean;
  /** What the author rates: text, or structured data. */
  output: unknown;
  /** Validation the Studio applied (dropped findings, flagged citations…). */
  notes: string[];
  error?: string;
  inputTokens: number;
  outputTokens: number;
  ms: number;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { OpenAICompatibleProvider } = await import("../../src/lib/llm/openai-compatible");
  const { generateJson } = await import("../../src/lib/llm/json");
  const { buildRewriteMessages, cleanProposal } = await import("../../src/lib/writing/ai/prompts");
  const { htmlToPlainText } = await import("../../src/lib/content/sanitize");
  const { htmlToDocument, documentSections } = await import("../../src/lib/writing/content");
  const { WORKFLOWS } = await import("../../src/lib/agent/workflows");
  type LLMProvider = InstanceType<typeof OpenAICompatibleProvider>;

  const data = JSON.parse(readFileSync(resolve(args.cases), "utf8")) as { style: { name: string; description: string; rules: Record<string, unknown> }; cases: Case[] };
  const cases = data.cases.filter((c) => !args.only || args.only.includes(c.category));
  const style = data.style as never;

  const providers = args.models.map((spec) => {
    const [model, baseUrl] = spec.split("@");
    const isOpenAI = !baseUrl;
    const url = baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const key = isOpenAI ? process.env.OPENAI_API_KEY : process.env.EVAL_API_KEY;
    if (isOpenAI && !key && !process.env.OPENAI_BASE_URL) throw new Error("OPENAI_API_KEY is not set.");
    return { label: spec, model, provider: new OpenAICompatibleProvider({ id: isOpenAI ? "openai" : "openai-compatible", baseUrl: url, apiKey: key }) };
  });

  const calls = cases.reduce((n, c) => n + (c.category === "brainstorm" || c.category === "outline" ? 1 : c.category === "draft" ? 2 : 1), 0);
  console.log(`${cases.length} cases × ${providers.length} model(s) ≈ ${calls * providers.length} AI calls (plus up to one retry each for invalid JSON).`);
  console.log(`Models: ${providers.map((p) => p.label).join(", ")}`);
  if (!args.yes) {
    console.log("Dry run. Add --yes to run it.");
    return;
  }

  function fakeContext(provider: LLMProvider, model: string, c: Case, usage: { in: number; out: number }, notes: string[], state: Record<string, unknown> = {}, approvals: Record<string, Record<string, unknown>> = {}) {
    const doc = c.document || c.notes
      ? (() => {
          const json = htmlToDocument(markdownishToHtml(c.document ?? c.notes ?? ""));
          return { id: "eval", title: c.id, excerpt: "", text: htmlToPlainText(markdownishToHtml(c.document ?? c.notes ?? "")), outline: documentSections(json) };
        })()
      : null;
    return {
      run: { id: "eval", documentId: null, createdBy: "eval" },
      input: { idea: c.idea, question: c.question, length: c.length ?? "medium" },
      state,
      approvals,
      document: doc,
      style,
      examples: [],
      signal: new AbortController().signal,
      async json(call: { system: string; user: string; schema: never; maxOutputTokens: number }) {
        const result = await generateJson(provider, { model, messages: [{ role: "system", content: call.system }, { role: "user", content: call.user }], maxOutputTokens: call.maxOutputTokens, timeoutMs: 180_000 }, call.schema);
        usage.in += result.usage.inputTokens;
        usage.out += result.usage.outputTokens;
        if (result.attempts > 1) notes.push(`needed ${result.attempts} attempts to produce valid JSON`);
        return result.data;
      },
      async search() {
        throw new Error("No live search in evaluation");
      },
      async log(message: string) {
        notes.push(message);
      },
    } as never;
  }

  async function runCase(p: (typeof providers)[number], c: Case): Promise<Output> {
    const usage = { in: 0, out: 0 };
    const notes: string[] = [];
    const started = Date.now();
    try {
      let output: unknown;
      if (c.category === "clarity" || c.category === "concise") {
        const messages = buildRewriteMessages({
          operation: c.operation ?? "improve",
          style,
          examples: [],
          documentTitle: "Evaluation",
          contextBefore: "",
          passageKind: "blocks",
          passageHtml: `<p>${escapeHtml(c.passage ?? "")}</p>`,
          contextAfter: "",
        });
        const result = await p.provider.generate({ model: p.model, messages, maxOutputTokens: 800, timeoutMs: 120_000 });
        usage.in += result.usage.inputTokens;
        usage.out += result.usage.outputTokens;
        output = { original: c.passage, rewrite: htmlToPlainText(cleanProposal(result.text, "blocks")) };
      } else if (c.category === "brainstorm") {
        output = (await WORKFLOWS.explore.steps[0].run(fakeContext(p.provider, p.model, c, usage, notes))).output;
      } else if (c.category === "outline") {
        output = (await WORKFLOWS.explore.steps[1].run(fakeContext(p.provider, p.model, c, usage, notes, {}, { direction: c.direction ?? {} }))).output;
      } else if (c.category === "draft") {
        const plan = (await WORKFLOWS.draft.steps[0].run(fakeContext(p.provider, p.model, c, usage, notes))).output;
        const written = (await WORKFLOWS.draft.steps[1].run(fakeContext(p.provider, p.model, c, usage, notes, { plan }))).output as { html: string };
        output = { notes: c.notes, draft: htmlToPlainText(written.html) };
      } else if (c.category === "critique") {
        output = { document: c.document, review: (await WORKFLOWS.review.steps[0].run(fakeContext(p.provider, p.model, c, usage, notes))).output };
      } else if (c.category === "research") {
        const sources = (c.sources ?? []).map((s, i) => ({ id: `src-${i + 1}`, ref: `S${i + 1}`, url: s.url, title: s.title, publisher: new URL(s.url).hostname, excerpt: s.content, publishedDate: null, query: c.question ?? "" }));
        const synth = (await WORKFLOWS.research.steps[2].run(fakeContext(p.provider, p.model, c, usage, notes, { search: { sources } }))).output;
        output = { question: c.question, sources: c.sources, synthesis: synth };
      }
      return { caseId: c.id, category: c.category, model: p.label, ok: true, output, notes, inputTokens: usage.in, outputTokens: usage.out, ms: Date.now() - started };
    } catch (error) {
      return { caseId: c.id, category: c.category, model: p.label, ok: false, output: null, notes, error: error instanceof Error ? error.message : String(error), inputTokens: usage.in, outputTokens: usage.out, ms: Date.now() - started };
    }
  }

  const outputs: Output[] = [];
  for (const c of cases) {
    for (const p of providers) {
      process.stdout.write(`${c.id} · ${p.label} … `);
      const out = await runCase(p, c);
      outputs.push(out);
      console.log(out.ok ? `ok (${out.ms} ms, ${out.inputTokens}+${out.outputTokens} tokens)` : `FAILED: ${out.error}`);
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join(args.out, stamp);
  mkdirSync(dir, { recursive: true });
  const results = { createdAt: new Date().toISOString(), models: providers.map((p) => p.label), cases, outputs };
  writeFileSync(join(dir, "results.json"), JSON.stringify(results, null, 2));
  writeFileSync(join(dir, "rating.html"), ratingPage(results));
  const failed = outputs.filter((o) => !o.ok).length;
  const tokens = outputs.reduce((n, o) => ({ in: n.in + o.inputTokens, out: n.out + o.outputTokens }), { in: 0, out: 0 });
  console.log(`\nDone: ${outputs.length - failed}/${outputs.length} outputs, ${tokens.in} input + ${tokens.out} output tokens.`);
  console.log(`Rate them: open ${join(dir, "rating.html")} in a browser.`);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** "## Heading" and "- item" notes to simple HTML for the document fixture. */
function markdownishToHtml(text: string): string {
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((li) => `<li><p>${escapeHtml(li)}</p></li>`).join("")}</ul>`);
    list = [];
  };
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("## ")) {
      flush();
      out.push(`<h2>${escapeHtml(t.slice(3))}</h2>`);
    } else if (t.startsWith("- ")) list.push(t.slice(2));
    else {
      flush();
      out.push(`<p>${escapeHtml(t)}</p>`);
    }
  }
  flush();
  return out.join("");
}

function ratingPage(results: unknown): string {
  // JSON is embedded as data; "<" is escaped so it can't close the script tag
  const payload = JSON.stringify(results).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Writing Studio evaluation</title>
<style>
:root{--bg:#fff;--fg:#171717;--muted:#6b6b6b;--line:#e5e5e5;--soft:#f6f6f6;--ok:#15803d;--bad:#b91c1c}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#ececec;--muted:#a0a0a0;--line:#2e2e2e;--soft:#1d1d1d;--ok:#4ade80;--bad:#f87171}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px 80px}h1{font-size:24px;margin:0 0 4px}.muted{color:var(--muted)}
.case{border:1px solid var(--line);border-radius:10px;margin:20px 0;overflow:hidden}.case>header{padding:10px 14px;background:var(--soft);display:flex;gap:10px;flex-wrap:wrap;align-items:baseline}
.input{padding:10px 14px;border-bottom:1px solid var(--line);white-space:pre-wrap;font-size:14px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
.out{padding:12px 14px;border-left:1px solid var(--line)}.out:first-child{border-left:0}.body{white-space:pre-wrap;font-size:14px;max-height:420px;overflow:auto;background:var(--soft);padding:10px;border-radius:6px}
.rate{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:10px;font-size:14px}textarea{width:100%;margin-top:8px;font:inherit;font-size:13px;padding:6px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
.err{color:var(--bad)}.note{font-size:12px;color:var(--muted)}button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid var(--line);background:var(--fg);color:var(--bg);cursor:pointer}
button.secondary{background:var(--bg);color:var(--fg)}.bar{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;z-index:2}
table{border-collapse:collapse;margin-top:12px;font-size:14px}td,th{border:1px solid var(--line);padding:6px 10px;text-align:left}.pass{color:var(--ok);font-weight:600}.fail{color:var(--bad);font-weight:600}
ul.tree{margin:4px 0;padding-left:18px}
</style></head><body><main>
<h1>Writing Studio evaluation</h1>
<p class="muted">Rate each output without knowing which model wrote it. Judge clarity, naturalness, your voice, logical strength, following the task, factual accuracy, source use, and how much editing it would need. <b>Acceptable</b> means you'd use it with light edits. Ratings are saved in this browser; download them when done.</p>
<div class="bar"><span id="progress" class="muted"></span><button id="download" class="secondary">Download ratings</button><button id="reveal">Reveal models and summary</button></div>
<div id="summary"></div><div id="cases"></div>
<script type="application/json" id="data">${payload}</script>
<script>
const data = JSON.parse(document.getElementById("data").textContent);
const key = "eval-ratings:" + data.createdAt;
let ratings = {};
try { ratings = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) {}
const save = () => { try { localStorage.setItem(key, JSON.stringify(ratings)); } catch (e) {} progress(); };
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function el(tag, props, ...kids){const e=document.createElement(tag);Object.assign(e,props||{});for(const k of kids){if(k!=null)e.append(k)}return e}
function render(value){
  if (value == null) return el("span",{textContent:"(nothing)"});
  if (typeof value !== "object") return el("span",{textContent:String(value)});
  if (Array.isArray(value)) { const ul=el("ul",{className:"tree"}); value.forEach(v=>ul.append(el("li",{},render(v)))); return ul; }
  const ul=el("ul",{className:"tree"}); for (const [k,v] of Object.entries(value)) { if (v==null || (Array.isArray(v)&&!v.length)) continue; ul.append(el("li",{},el("b",{textContent:k+": "}),render(v))); } return ul;
}
const cases = document.getElementById("cases");
for (const c of data.cases) {
  const outs = data.outputs.filter(o => o.caseId === c.id).sort((a,b) => hash(c.id+a.model) - hash(c.id+b.model));
  const input = c.passage || c.idea || c.notes || c.document || c.question || "";
  const card = el("section",{className:"case"},
    el("header",{}, el("b",{textContent:c.id}), el("span",{className:"muted",textContent:c.category})),
    el("div",{className:"input",textContent:input}));
  const grid = el("div",{className:"grid"});
  outs.forEach((o, i) => {
    const id = c.id + "|" + o.model;
    const r = ratings[id] || (ratings[id] = {});
    const name = "r-" + hash(id);
    const body = el("div",{className:"body"});
    const shown = o.output && typeof o.output === "object" ? (o.output.rewrite ?? o.output.draft ?? o.output.review ?? o.output.synthesis ?? o.output) : o.output;
    body.append(typeof shown === "string" ? el("span",{textContent:shown}) : render(shown));
    const yes = el("input",{type:"radio",name,checked:r.acceptable===true,onchange:()=>{r.acceptable=true;save()}});
    const no = el("input",{type:"radio",name,checked:r.acceptable===false,onchange:()=>{r.acceptable=false;save()}});
    const score = el("select",{onchange:e=>{r.score=Number(e.target.value)||undefined;save()}}, el("option",{value:"",textContent:"Score"}), ...[1,2,3,4,5].map(n=>el("option",{value:n,textContent:n,selected:r.score===n})));
    const note = el("textarea",{rows:2,placeholder:"Notes (optional)",value:r.note||"",oninput:e=>{r.note=e.target.value;save()}});
    grid.append(el("div",{className:"out"},
      el("p",{},el("b",{textContent:"Output " + (i+1)}), (() => { const s = el("span",{className:"model muted"}); s.dataset.model = o.model; return s; })()),
      o.ok ? body : el("p",{className:"err",textContent:"Failed: " + o.error}),
      o.notes.length ? el("p",{className:"note",textContent:"Studio checks: " + o.notes.join("; ")}) : null,
      el("div",{className:"rate"}, el("label",{},yes," Acceptable"), el("label",{},no," Not acceptable"), score), note));
  });
  card.append(grid); cases.append(card);
}
function progress(){const total=data.outputs.length;const done=Object.values(ratings).filter(r=>typeof r.acceptable==="boolean").length;document.getElementById("progress").textContent=done+" of "+total+" rated"}
progress();
document.getElementById("download").onclick = () => {
  const blob = new Blob([JSON.stringify({ createdAt: data.createdAt, models: data.models, ratings }, null, 2)], { type: "application/json" });
  const a = el("a",{href:URL.createObjectURL(blob),download:"ratings-"+data.createdAt.slice(0,10)+".json"}); a.click();
};
document.getElementById("reveal").onclick = () => {
  document.querySelectorAll(".model").forEach(s => s.textContent = " · " + s.dataset.model);
  const cats = [...new Set(data.cases.map(c=>c.category))];
  const table = el("table",{}, el("tr",{}, el("th",{textContent:"Model"}), el("th",{textContent:"Acceptable"}), el("th",{textContent:"Avg score"}), ...cats.map(c=>el("th",{textContent:c})), el("th",{textContent:"Gate (≥85%)"})));
  for (const m of data.models) {
    const rs = data.outputs.filter(o=>o.model===m).map(o=>({o, r: ratings[o.caseId+"|"+m] || {}}));
    const rated = rs.filter(x=>typeof x.r.acceptable==="boolean");
    const share = rated.length ? rated.filter(x=>x.r.acceptable).length / rated.length : 0;
    const scores = rs.map(x=>x.r.score).filter(Boolean);
    const avg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2) : "–";
    const byCat = cats.map(cat => { const xs = rated.filter(x=>x.o.category===cat); return xs.length ? Math.round(100*xs.filter(x=>x.r.acceptable).length/xs.length)+"%" : "–"; });
    const pass = rated.length === rs.length && share >= 0.85;
    table.append(el("tr",{}, el("td",{textContent:m}), el("td",{textContent:Math.round(share*100)+"% of "+rated.length+"/"+rs.length+" rated"}), el("td",{textContent:avg}), ...byCat.map(t=>el("td",{textContent:t})), el("td",{className:pass?"pass":"fail",textContent:pass?"Pass":(rated.length<rs.length?"Rate all outputs":"Below 85%")})));
  }
  const s = document.getElementById("summary"); s.innerHTML = ""; s.append(el("h2",{textContent:"Summary"}), table);
  s.scrollIntoView({ behavior: "smooth" });
};
</script></main></body></html>`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
