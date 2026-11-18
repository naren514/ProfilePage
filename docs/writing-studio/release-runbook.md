# Writing Studio: release runbook

How to ship the Writing Studio (M0–M5) to narenc.com, check it, watch it, and
roll it back. Written for the owner; no prior context needed.

## 1. Before you deploy

**Take a database snapshot.** The migration is additive: it only adds tables
and columns, and existing posts aren't changed. Still, take a snapshot first:
- In the Neon console, open the project and create a **branch** from `main`
  named e.g. `before-writing-studio`. It's an instant copy you can restore from.
- Check point-in-time restore is enabled for your plan (Neon → Settings →
  Storage → History retention).

**Set environment variables in Vercel** (Project → Settings → Environment Variables, Production):

| Variable | Needed for | Notes |
|---|---|---|
| `DATABASE_URL` | everything | already set |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | login | already set |
| `AUTH_SESSION_SECRET` | login | **Make sure this is set** to a long random value (`openssl rand -base64 32`). Without it, the session cookie is signed with the admin password. |
| `OPENAI_API_KEY` | AI edits, workflows, chat | Without it the editor works and AI features show as unavailable. |
| `TAVILY_API_KEY` | research workflow | Optional. Without it, only research is unavailable. |
| `BLOB_READ_WRITE_TOKEN` | image uploads in posts | already set for photos |
| `OPENAI_WRITING_FAST_MODEL`, `OPENAI_WRITING_QUALITY_MODEL` | starting models | Optional; models can be changed in the app later. |

Don't set `DATABASE_DRIVER` or `OPENAI_BASE_URL` in production. They're for
local testing and Phase 2.

## 2. Deploy

1. Merge the branch (or deploy it as a preview first: Vercel builds a preview
   for every branch push; try steps 3–4 there against a Neon branch).
2. Wait for the production deployment to finish.

## 3. After deploying (once)

1. Log in and open **Admin → Thoughts**. Click **Set up now**. It creates or
   updates the Studio's tables and is safe to repeat. Your existing posts are
   copied in as drafts; the live posts aren't touched.
2. Open one or two existing posts in the Studio and check they look right.
   Open their public pages under `/thoughts/…` and check the old
   `/volunteer/…` address redirects there.
3. Go to `/admin/documents` and click **RAG Index Sync**, which rebuilds the
   public chatbot's index from *published* posts only.
4. **Styles & AI → AI settings & usage:**
   - Set the fast and quality models.
   - Check their prices against OpenAI's pricing page. A model without a price
     is counted at $10/$50 per 1M tokens.
   - Check the Tavily price per search against your plan.
   - Confirm the monthly budget ($20) and the per-run limit ($0.50).
5. Edit the three starter styles to sound like you, and save one or two
   writing samples from your posts.

## 4. Smoke test (10 minutes)

- [ ] Create a new thought, type, wait for "Saved", reload: the text is still there.
- [ ] Select a sentence → Improve → Accept → Ctrl+Z undoes it.
- [ ] Assistant → Editorial review finishes and shows findings.
- [ ] Assistant → Research a question (if Tavily is set): sources show with links.
- [ ] Publish the test post, open it at `/thoughts/<slug>`, then Unpublish it (it 404s) and delete it.
- [ ] Thoughts → Export downloads a ZIP that opens.
- [ ] Activity shows the runs and the cost so far.

## 5. Watching it

- **Admin → Thoughts → Activity** shows 30-day spend, AI requests, how many
  suggestions you kept, workflow outcomes, typical run time, cost by
  feature, and recent failures linked to their runs.
- **Styles & AI → AI settings & usage** shows this month's spend against the
  budget. AI stops at the budget; writing and publishing don't.
- **Vercel → Logs** has the details for errors. Workflow steps log
  `Agent run … step … failed` and AI failures log `Rewrite failed` or
  `Chat reply failed`.
- Things worth a look:
  - repeated failures of the same workflow (usually a wrong model name or an expired key);
  - spend climbing faster than expected;
  - "Not saved, retrying" lasting more than a minute (database or network trouble).

## 6. Rolling back

From least to most drastic:

1. **One bad AI edit or wrong text:** Ctrl+Z, or **Versions** in the editor → restore. Restoring never deletes history.
2. **A wrong style change:** Styles & AI → the style → History → Restore.
3. **The Studio misbehaves but the site is fine:** use the classic editor at
   `/admin/stories/classic`. It edits the live posts directly. The Studio flags
   those edits as "Edited outside Studio" and can pull them in later.
4. **Turn AI off:** Styles & AI → AI settings → switch off AI suggestions.
   Or remove `OPENAI_API_KEY` in Vercel and redeploy.
5. **Bad deployment:** Vercel → Deployments → the previous one → **Promote to
   Production** (instant). The extra tables are harmless to older code.
6. **Database problem:** restore from the Neon branch or a point in time
   (Neon → Branches → Restore). This loses changes made after that point, so
   export first (Thoughts → Export) if the app still works.

## 7. Retiring the classic editor (later)

After 2–4 weeks without needing it:
1. Remove `src/app/admin/stories/classic/` and the link to it at the bottom of the Thoughts list.
2. Keep `/api/admin/stories` for now; the dashboard counts use the table.
3. Search for "Edited outside Studio". That banner can stay, since it's harmless.

## 8. Evaluating models

The PRD's quality gate is that at least 85% of 40 representative outputs are
acceptable to you. To check a model (or compare two, e.g. OpenAI against a
local model in Phase 2):

```bash
npm run eval -- --model gpt-6.2-sol
```

```bash
npm run eval -- --model gpt-6.2-sol --yes
```

The first command is a dry run that shows how many calls it would make; the
second runs it. For two models:

```bash
npm run eval -- --model gpt-6.2-sol --model llama3.3@http://localhost:11434/v1 --yes
```

It needs `OPENAI_API_KEY` in your shell. It writes
`eval-results/<time>/rating.html`. Open it, mark each output acceptable or not
(the model names are hidden), then click **Reveal models and summary**. The
cases live in `tests/eval/cases.json`; edit them to match what you write.

## 9. Known limitations

- **One author.** Records store the owner, but there are no per-user permissions.
- **Samples are matched by keywords, not meaning.** That's cheap and model-independent; embeddings can be added later.
- **Long chats leave out older messages** rather than summarizing them.
- **Edited suggestions go in as plain paragraphs**, without the formatting the AI used.
- **The research step relies on Tavily's documented v1 API.** Watch the first real runs.
- **Run time limits come from Vercel's function duration.** Each workflow step
  is one request with up to 300 s allowed, which is plenty for current steps.
- **Mobile:** the admin layout has a fixed sidebar and isn't optimized for phones.

## 10. Test evidence

Run locally (see `tests/e2e/README.md`):

| Suite | Covers | Checks |
|---|---|---|
| `npm test` | Unit tests: sanitizing, slugs, autosave engine, content round trip, prompts, budgets, workflows, memory, export, security helpers | 150+ |
| `writing-studio.cjs` | M1: editor, autosave, conflicts, offline, crash recovery, versions, publish | 27 |
| `writing-studio-ai.cjs` | M2: AI edits, styles, budget, prompt fencing | 28 |
| `writing-studio-agent.cjs` | M3: workflows, research, chat, cancel and resume, audit, health panel | 36 |
| `writing-studio-memory.cjs` | M4: samples, feedback, learning with approval, memory export | 26 |
| `writing-studio-security.cjs` | M5: auth on all routes, cross-site writes, XSS, draft privacy, limits, full export | 29 |

PRD §14.1 Phase 1 exit criteria:
- **Editor stable, old posts unaffected, autosave and recovery proven:** M1 suite and content round-trip tests.
- **AI edits are proposals that can be reversed; research and review are grounded:** M2 and M3 suites.
- **Memory persists under the author's control; publishing requires approval:** M3 and M4 suites.
- **Exports work; security and acceptance tests pass; the model adapter's contract tests are green:** M5 security suite, the unit adapter tests, and `npm run eval`. The evaluation needs your ratings with a real model.
