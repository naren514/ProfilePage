// A stand-in for the OpenAI Chat Completions API and the Tavily search API,
// for end-to-end tests. Streams deterministic replies and records requests.
//
//   node tests/e2e/mock-openai.cjs [port]      (default 3999)
//   POST /v1/chat/completions   OpenAI-compatible (point OPENAI_BASE_URL at /v1)
//   POST /search                Tavily-compatible (point TAVILY_BASE_URL at the root)
//   GET  /__requests            received chat request bodies
//   GET  /__searches            received search request bodies
//   GET  /articles/*            a fixture article page (reading list tests)
//   GET  /go/*                  a short link that redirects to /articles/tms-data
//   POST /__fixtures            {"set": name} replays tests/agent-eval/fixtures/web/<name> (agent eval)
//
// Selection rewrites: inline passages -> "a much tighter phrase"; block passages
// -> "<p>Rewritten by the mock AI.</p>". Workflow steps are recognised by their
// "Task id:" line and get canned JSON (the first explore_angles reply is
// deliberately invalid, to exercise the repair round). Text containing SLOW
// streams slowly. Model "broken-model" returns 404.

const http = require("http");

const port = Number(process.argv[2] || 3999);
// Agent eval (A0): a fixture set replays recorded search results and can
// override task replies. Chosen per task with POST /__fixtures {"set": "<name>"}.
const fixturesRoot = process.env.MOCK_FIXTURES || require("path").join(__dirname, "../agent-eval/fixtures/web");
let fixtureSet = null;
const readFixture = (name) => {
  try {
    return JSON.parse(require("fs").readFileSync(require("path").join(fixturesRoot, fixtureSet, name), "utf8"));
  } catch {
    return null;
  }
};
const requests = [];
const searches = [];
const pageReads = [];
const seenTasks = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const words = (n, seed) => Array.from({ length: n }, (_, i) => `${seed}${i % 7 === 6 ? "." : ""}`).join(" ");

const TASK_REPLIES = {
  explore_angles: {
    angles: [
      { title: "The plan nobody read", summary: "Why written plans fail when nobody uses them." },
      { title: "Lessons from a long migration", summary: "What ten years of data taught the team." },
    ],
    theses: ["Planning beats heroics.", "Migrations fail quietly, long before launch."],
    audiences: [{ name: "Engineering leads", why: "they plan migrations" }],
    questions: ["What went wrong first?"],
    counterarguments: ["Some teams move fast and still succeed."],
  },
  outline_candidates: {
    outlines: [
      {
        title: "Why the plan failed",
        sections: [
          { heading: "The plan nobody read", points: ["ten years of data", "one plan"] },
          { heading: "What we changed", points: ["short checklists"] },
        ],
      },
      { title: "A second outline", sections: [{ heading: "Start", points: ["a"] }, { heading: "End", points: ["b"] }] },
    ],
  },
  draft_plan: {
    sections: [
      { heading: "The plan nobody read", intent: "Set the scene", keyPoints: ["ten years of data"] },
      { heading: "What we changed", intent: "Show the fix", keyPoints: ["checklists"] },
    ],
  },
  draft_write: {
    sections: [
      { heading: "The plan nobody read", html: `<p>Drafted background paragraph. ${words(30, "context")}</p>` },
      { heading: "What we changed", html: `<p>Drafted lessons paragraph. ${words(30, "change")}</p>` },
    ],
  },
  draft_review: { summary: "The draft flows well.", issues: ["Add one concrete example."] },
  research_plan: { queries: ["data migration failure rate"] },
  research_synthesize: {
    summary: "The sources agree that large migrations often overrun.",
    findings: [
      { statement: "Most large migrations overrun their schedule.", sources: ["S1", "S2"], kind: "fact" },
      { statement: "A claim that cites nothing real.", sources: ["S9"], kind: "fact" },
    ],
    disagreements: ["How much they overrun."],
    openQuestions: ["Whether small teams see the same."],
  },
  editorial_review: {
    overall: "A clear start that needs evidence.",
    strengths: ["Concrete opening"],
    findings: [
      { category: "evidence", severity: "high", quote: "Drafted background paragraph.", issue: "This claim needs support.", suggestion: "Add a source.", needsEvidence: true },
      { category: "clarity", severity: "low", quote: "A sentence the model made up entirely.", issue: "x", suggestion: "y", needsEvidence: false },
    ],
  },
  reading_digest: {
    brief: ["You saved pieces on transport data quality and EDI reliability.", "Both argue boring foundations decide outcomes."],
    items: [
      { ref: "R1", tags: ["Supply chain", "Data"], strong: true, why: "A strong case for a post on data-first rollouts." },
      { ref: "R2", tags: ["EDI"], strong: false, why: "" },
      { ref: "R3", tags: ["Architecture"], strong: true, why: "Pairs well with your rollback post." },
    ],
  },
  reading_note: { note: "A clear-eyed case that master data, not configuration, decides how a rollout goes.", tags: ["Supply chain", "Data"] },
  publish_metadata: {
    titles: ["Ten years, one plan", "What a migration taught me", "Plans nobody reads"],
    excerpts: ["A short excerpt about plans.", "Another excerpt."],
    slug: "lessons-from-a-migration",
    tags: ["Engineering", "migrations"],
  },
};

// A2: a scripted stand-in for the agent's per-turn choice. It reads the
// Status line and goal from the prompt. Special goals exercise the guards:
// LOOPTEST repeats one action, STALLTEST makes no progress, FETCHEVIL tries to
// read an address that no search returned.
function agentTurnReply(user) {
  const goal = (user.match(/<goal>([\s\S]*?)<\/goal>/) || [])[1] || "";
  const status = user.match(/Status: turn=(\d+) sources=(\d+) fetched=(\d+)/) || [];
  const turn = Number(status[1] || 1);
  const sources = Number(status[2] || 0);
  const fetched = Number(status[3] || 0);
  const searches = (user.split("What you've done:")[1] || "").split("Status:")[0].match(/: web\.search /g)?.length || 0;
  const plan = (done) => [
    { text: "Search for evidence", status: sources > 0 ? "done" : "doing" },
    { text: "Read the key source in full", status: fetched > 0 ? "done" : sources > 0 ? "doing" : "todo" },
    { text: "Propose cited findings", status: done ? "doing" : "todo" },
  ];
  const act = (tool, args, done = false) => JSON.stringify({ plan: plan(done), action: { tool, args } });
  if (goal.includes("LOOPTEST")) return act("web.search", { query: "the same query again" });
  if (goal.includes("STALLTEST")) return JSON.stringify({ action: { tool: "doc.read", args: { heading: `no such heading ${turn}` } } });
  if (goal.includes("FETCHEVIL") && turn === 1) return act("web.fetch", { source: "https://evil.example/exfiltrate" });
  if (sources === 0) return act("web.search", { query: "data migration overruns" });
  if (sources < 3 && searches < 2) return act("web.search", { query: "migration overrun survey data" });
  const fetchTries = (user.split("What you've done:")[1] || "").split("Status:")[0].match(/: web\.fetch /g)?.length || 0;
  if (fetched === 0 && fetchTries < 1) return act("web.fetch", { source: "S1" });
  const refs = Array.from({ length: sources }, (_, i) => `S${i + 1}`);
  const findings = sources >= 2
    ? [
        { statement: "Most large migrations finish later than planned.", sources: [refs[0]], kind: "fact" },
        { statement: "Data quality problems are the most cited cause of delay.", sources: [refs[1]], kind: "fact" },
        { statement: "Fixing data early seems to matter more than tooling.", sources: refs.slice(0, 2), kind: "interpretation" },
      ]
    : [{ statement: "Practitioners argue data quality matters more than configuration.", sources: [refs[0]], kind: "interpretation" }];
  return act("research.propose_findings", {
    summary: sources >= 2 ? "The sources agree most migrations overrun, mostly because of data." : "Only one opinion source was found.",
    findings,
    disagreements: [],
    openQuestions: ["Whether this holds for small teams."],
  }, true);
}

function replyFor(body) {
  const user = body.messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const system = body.messages.find((m) => m.role === "system")?.content ?? "";
  const task = (user.match(/Task id: (\w+)/) || [])[1];
  if (task === "learn_preferences") {
    // Cite the feedback ids found in the prompt: one well-supported proposal,
    // one with too little evidence, and one that conflicts with a rule
    const ids = Array.from(new Set(user.match(/\[([0-9a-f]{8}-[0-9a-f-]{27})\]/g) || [])).map((m) => m.slice(1, -1));
    return JSON.stringify({
      proposals: [
        { field: "avoid", action: "add", text: "basically", rationale: "You rejected or removed it several times.", evidence: ids.slice(0, 3), conflictsWith: null },
        { field: "sentences", action: "add", text: "Prefer very short sentences", rationale: "One edit shortened sentences.", evidence: ids.slice(0, 1), conflictsWith: null },
        { field: "voice", action: "add", text: "Write in the third person", rationale: "Some edits removed 'I'.", evidence: ids.slice(1, 3), conflictsWith: "First person, warm and honest." },
      ],
    });
  }
  const override = fixtureSet ? readFixture("replies.json") : null;
  if (task && override && override[task]) return JSON.stringify(override[task]);
  if (task === "agent_turn") return agentTurnReply(user);
  if (task && TASK_REPLIES[task]) {
    seenTasks[task] = (seenTasks[task] || 0) + 1;
    // First explore reply is malformed on purpose (tests the repair round)
    if (task === "explore_angles" && seenTasks[task] === 1) return "Here are some ideas: angles, theses…";
    return JSON.stringify(TASK_REPLIES[task]);
  }
  if (system.includes("writing partner")) return "Your strongest point is **the plan**. Consider opening with it.";
  return user.includes('<passage kind="inline">') ? "a much tighter phrase" : "<p>Rewritten by the mock AI.</p>";
}

http
  .createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/__requests") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(requests));
    }
    if (req.method === "POST" && req.url === "/__fixtures") {
      let body = "";
      for await (const chunk of req) body += chunk;
      fixtureSet = JSON.parse(body || "{}").set || null;
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ set: fixtureSet }));
    }
    if (req.method === "GET" && req.url === "/__searches") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(searches));
    }
    // Reading list fixtures: an article page and a short link that redirects to it
    if (req.method === "GET" && req.url.startsWith("/articles/")) {
      // Each /articles/<slug> is its own article (canonical address and title follow the slug)
      const slug = req.url.split("?")[0].slice("/articles/".length) || "tms-data";
      let html = require("fs").readFileSync(require("path").join(__dirname, "fixtures", "article.html"), "utf8").replace(/\/articles\/tms-data/g, `/articles/${slug}`);
      if (slug !== "tms-data") html = html.replace(/(og:title" content=")([^"]+)/, `$1$2 (${slug})`);
      // "raw" keeps its query in the canonical address (tests links with their own parameters)
      if (slug === "raw") html = html.replace(/(rel="canonical" href=")[^"]+/, `$1${req.url.replace(/&/g, "&amp;")}`);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(html);
    }
    // Agent web.fetch replay (AGENT_FETCH_REPLAY_URL=<mock>/__page): a recorded page if the
    // fixture set has one, else a page built from the search result for that address
    if (req.method === "GET" && req.url === "/__pages") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(pageReads));
    }
    if (req.method === "GET" && req.url.startsWith("/__page")) {
      const target = new URL(req.url, "http://x").searchParams.get("url") || "";
      pageReads.push(target);
      const pages = fixtureSet ? readFixture("pages.json") : null;
      if (pages && pages[target]) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(pages[target]);
      }
      const recorded = fixtureSet ? readFixture("search.json") : null;
      const all = recorded ? Object.values(recorded).flat() : [
        { title: "Migration study", url: "https://research.example/migrations", content: "Large migrations overran their schedule in most cases studied." },
        { title: "Industry survey", url: "https://survey.example/report", content: "Surveyed teams reported delays on big data moves." },
      ];
      const hit = all.find((r) => r.url === target);
      if (!hit) {
        res.writeHead(404, { "Content-Type": "text/html" });
        return res.end("<html><body>Not found</body></html>");
      }
      const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<html><head><title>${esc(hit.title)}</title></head><body><nav>Home · About</nav><article><h1>${esc(hit.title)}</h1><p>${esc(hit.content)}</p><p>${esc(hit.content)} The full article explains the method and its limits in more detail.</p></article><footer>© Example</footer></body></html>`);
    }
    if (req.method === "GET" && req.url.startsWith("/go/")) {
      res.writeHead(302, { Location: "/articles/tms-data?utm_source=share&fbclid=abc" });
      return res.end();
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;

    if (req.method === "POST" && req.url === "/search") {
      const body = JSON.parse(raw || "{}");
      searches.push({ ...body, auth: req.headers.authorization ?? null });
      if (String(body.query).includes("SLOW")) await sleep(8000);
      const recorded = fixtureSet ? readFixture("search.json") : null;
      if (recorded) {
        // Replay: the same recorded results whatever the model asked for
        const key = String(body.query).toLowerCase().replace(/\s+/g, " ").trim();
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ query: body.query, results: recorded[key] ?? recorded.default ?? [] }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          query: body.query,
          results: [
            { title: "Migration study", url: "https://research.example/migrations", content: "Large migrations overran their schedule in most cases studied.", score: 0.9 },
            { title: "Industry survey", url: "https://survey.example/report", content: "Surveyed teams reported delays on big data moves.", score: 0.8 },
            { title: "Not a web page", url: "ftp://files.example/x", content: "ignored", score: 0.1 },
          ],
        })
      );
    }

    if (req.method !== "POST" || !req.url.endsWith("/chat/completions")) {
      res.writeHead(404);
      return res.end();
    }
    const body = JSON.parse(raw);
    requests.push(body);

    if (body.model === "broken-model") {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "The model `broken-model` does not exist", code: "model_not_found" } }));
    }

    const all = body.messages.map((m) => m.content).join("\n");
    const slow = /<passage[^>]*>[\s\S]*SLOW[\s\S]*<\/passage>/.test(all) || /<question>[^<]*SLOW/.test(all);
    const reply = replyFor(body);
    const pieces = reply.match(/[\s\S]{1,24}/g) || [""];

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    let closed = false;
    req.on("close", () => (closed = true));
    for (const piece of pieces) {
      if (closed) return;
      send({ model: body.model, choices: [{ delta: { content: piece } }] });
      await sleep(slow ? 1500 : 10);
    }
    send({ model: body.model, choices: [{ delta: {}, finish_reason: "stop" }] });
    send({ model: body.model, choices: [], usage: { prompt_tokens: 1200, completion_tokens: 40 } });
    res.write("data: [DONE]\n\n");
    res.end();
  })
  .listen(port, () => console.log(`mock OpenAI + Tavily listening on ${port}`));
