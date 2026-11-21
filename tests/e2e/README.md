# Writing Studio end-to-end check

**All suites at once (what CI runs):** after `npm run build`, run
`ADMIN_DATABASE_URL=… DATABASE_URL=… bash tests/e2e/run-all.sh`. Each suite gets a
freshly seeded database, a fresh mock server and a fresh app.

**Background agents (A1):** `agent-server.cjs` covers:
- runs executed on the server with no tab open;
- approvals that resume on the server;
- cron and event triggers, including duplicate protection;
- per-automation daily budgets, the kill switch, expiry and the Automations page.

`run-all.sh` sets `CRON_SECRET`, `AGENT_TEST_CLOCK=1` (`?now=` on the cron endpoint, tests only) and `PORT` for Vercel Workflow's local engine.

**Agent eval:**
- `npm run agent:eval -- --mode mock --compare` runs the 30 agent goals against
  a scratch database with the mock AI and replayed web fixtures, and fails on
  a regression.
- See `docs/writing-studio/agent-baseline.md` for the real-model run.

Drives a real browser through the Studio against a local Postgres:
import of old posts, autosave, conflicts between tabs, offline retry, crash
recovery, versions and restore, publish/unpublish, drafts staying private,
and the `/volunteer` → `/thoughts` redirect.

```bash
createdb studio_e2e && psql studio_e2e -f tests/e2e/seed.sql
npm run build
DATABASE_DRIVER=pg DATABASE_URL=postgresql://localhost/studio_e2e \
  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=e2e-password AUTH_SESSION_SECRET=e2e-secret \
  npx next start -p 3100 &
node tests/e2e/writing-studio.cjs   # screenshots go to test-results/
```

### AI editing (M2)

`writing-studio-ai.cjs` covers writing styles, AI settings, selection edits
(accept, undo, reject, stale, cancel, custom, per-style), prompt fencing,
provider errors and the budget cap. It uses a fake OpenAI server:

```bash
node tests/e2e/mock-openai.cjs 3999 &
# start the app as above, plus OPENAI_BASE_URL=http://localhost:3999/v1
node tests/e2e/writing-studio-ai.cjs
```

### Agent workflows (M3)

`writing-studio-agent.cjs` covers quick capture and ideas, Idea → outline
(with a deliberately broken AI reply that must be repaired), Outline → draft,
editorial review, research with Tavily, publish prep, chat, cancel, resume
after reload, approval and login boundaries, the per-run budget and the
activity log. The same mock serves Tavily at `/search`:

```bash
# app started with OPENAI_BASE_URL=http://localhost:3999/v1 TAVILY_BASE_URL=http://localhost:3999
node tests/e2e/writing-studio-agent.cjs
```

### Reading list

`reading-list.cjs` covers the browser popup (login and return, page details,
highlighted quote, AI note suggestion, Keep private / Publish now), the admin
inbox (use suggestion, publish, archive), the token API used by the iPhone
Shortcut (shared text with a short link, duplicates, typed notes, the AI
suggestion never published by itself, invalid and revoked tokens) and the
public page. The mock serves the fixture article at `/articles/*` and a short
link at `/go/*`; start the app with `READING_ALLOW_PRIVATE_HOSTS=1` so it may
fetch from localhost (test only, never in a deployment):

```bash
# app started as for the agent suite, plus READING_ALLOW_PRIVATE_HOSTS=1
node tests/e2e/reading-list.cjs
```

### Writing memory (M4)

`writing-studio-memory.cjs` covers saving samples from the editor, samples
reaching (and, when disabled, not reaching) the AI, reject reasons,
edit-before-accept, the learning workflow (evidence threshold, set-aside and
conflicting proposals, approval, new version with provenance, protection
against a style edited meanwhile), export, and deleting feedback. Same setup
as the agent suite.

### Security and export (M5)

`writing-studio-security.cjs` covers every Studio API endpoint refusing
anonymous and forged sessions, cross-site writes being blocked, XSS payloads in
a published post (checked with the browser's own parser), draft privacy, input
limits, upload types, error hygiene, and the full ZIP export. It needs no mock AI.

### Model evaluation

`npm run eval` runs the 40 cases in `tests/eval/cases.json`; see
`docs/writing-studio/release-runbook.md` §8. To try it without an API key,
point it at the mock: `OPENAI_BASE_URL=http://localhost:3999/v1 OPENAI_API_KEY=x npm run eval -- --model a --model b@http://localhost:3999/v1 --yes`.

If Playwright can't find a browser, set `CHROMIUM_PATH` to a Chromium binary.

Recreate the database before each run; the scripts expect the seeded state.
`DATABASE_DRIVER=pg` is for local runs only. Production uses Neon over HTTP.
