# Writing Studio end-to-end check

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

### Writing memory (M4)

`writing-studio-memory.cjs` covers saving samples from the editor, samples
reaching (and, when disabled, not reaching) the AI, reject reasons,
edit-before-accept, the learning workflow (evidence threshold, set-aside and
conflicting proposals, approval, new version with provenance, protection
against a style edited meanwhile), export, and deleting feedback. Same setup
as the agent suite.

If Playwright can't find a browser, set `CHROMIUM_PATH` to a Chromium binary.

Recreate the database before each run; the scripts expect the seeded state.
`DATABASE_DRIVER=pg` is for local runs only. Production uses Neon over HTTP.
