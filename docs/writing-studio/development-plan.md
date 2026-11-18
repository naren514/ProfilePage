# Writing Studio — Discovery, Development Plan & Open Decisions

Companion to *Naren's Writing Studio — Comprehensive PRD v1.0* (2026-11-18).
This covers PRD §2.1 (mandatory discovery), the ADR inputs it requires, a milestone plan
adapted to this codebase, and the decisions that need an owner call.

## Status (2026-11-18)

| Milestone | State | Notes |
|---|---|---|
| M0 | Done | Draft leak to chatbot, sanitization, slug lock, edit conflicts, Vitest |
| M1 | Done | D1 and D2 approved. Full-page editor, autosave, versions, publish/unpublish, preview, legacy import, `/thoughts` URLs |
| M2 | Done | D6: $20/month cap, two model tiers set in settings. Writing styles per post (pulled forward from M4), AI edits on selected text |

**M2 implementation notes:**
- **Provider contract** is in `src/lib/llm` (`generate`, `stream`, `capabilities`, typed errors, usage, abort and timeout). The single adapter speaks the OpenAI Chat Completions format, which Ollama and vLLM also serve, so Phase 2 is mostly a base-URL and capability change (`OPENAI_BASE_URL`).
- **Models and prices aren't hard-coded.** OpenAI's official pricing page couldn't be reached from the build environment, so the models are settings with starting values, and prices are editable. Models without a price are counted at $10/$50 per 1M tokens, so the budget errs on the safe side. No `temperature` is sent, because several current models reject it.
- **Writing styles** are author-written rules (voice, sentences, structure, words to avoid, other) plus up to two example posts. Every save is a version you can restore. Three starter styles are seeded. Each post picks a style, with the default as fallback, and "Rewrite as <style>" overrides it for a single request. Learning styles from feedback stays in M4.
- **Selection edits:** Improve, Shorten, Expand, Simplify, Fix grammar, Improve flow, Rewrite in a style, and a custom instruction.
  - The proposal streams in, then shows as a word diff with Accept/Reject/Try again.
  - Accept is one undoable transaction and records "Before an AI edit" and "AI suggestion accepted" versions.
  - The passage is tracked through later edits. If its text changed, the suggestion is refused as stale.
  - "What the AI saw" shows the model, style, example titles, how much context was sent, the prompt version, the cost and the full prompt (FR-AI-001).
- **Prompt assembly** follows PRD §14 order. Author content is fenced and wrapper tags are neutralized, so text in a draft can't open new prompt sections.
- **Budget:** every call is checked against month-to-date spend plus a worst-case estimate before it is sent. Cancelled or failed streams are recorded as estimates.
- **Deferred to M3:** the persisted writing-partner chat (FR-AI-005), which fits better alongside the agent workflows.

**M1 implementation notes (deviations from the plan above):**
- **D9:** used Neon's atomic `db.batch()` (via `atomic()` in `lib/db`) instead of adding the WebSocket Pool. Publish, restore and pull-live are single transactions. A revision guard sub-select makes a batch fail when the base revision is stale.
- **Tables are created by the Studio's "Set up now" button** (`/api/admin/writing/setup`, idempotent DDL in `lib/writing/setup-sql.ts`). No drizzle migration was generated: the migration history has drifted from the live schema (`rate_limit_requests` is missing from it), so `db:migrate` isn't safe to run.
- **Legacy STAR fields (D3) are deferred safely.** Publishing only writes title/slug/summary/body/date/tags, so old STAR sections keep rendering.
- **The classic editor stays at `/admin/stories/classic` as the rollback path.** Edits made there are detected ("Edited outside Studio") and can be pulled into the draft.
- **Not in M1, moved to M2:** stable block IDs (needed for AI suggestion anchors), the left rail, and ideas/quick capture. Record ownership is stored (`owner_email`) but not enforced, because there's one admin.

---

## 1. Discovery findings (what exists today)

### 1.1 Stack
| Area | Current state | Implication |
|---|---|---|
| Framework | Next.js 14 App Router, React 18, TypeScript, Tailwind + shadcn/Radix | Build the Studio inside the existing app. No FastAPI service needed. |
| Editor | **Tiptap v3 is already in use** (StarterKit, Underline, Link, Image, Placeholder) | No editor migration. Bodies are saved as **HTML** (`editor.getHTML()`), not JSON. |
| DB / ORM | Neon Postgres via `drizzle-orm/neon-http`, drizzle-kit migrations (5 so far) plus ad-hoc `add-schema-updates.ts` | The **neon-http driver has no interactive transactions**. Use conditional `UPDATE … WHERE revision = $n` and `db.batch()`, or add the Neon WebSocket `Pool` driver for the writing module. |
| Vectors | pgvector is installed; `document_chunks.embedding` is a fixed `vector(3072)` column (text-embedding-3-large) | 3072 dims can't use an HNSW/IVFFlat index on `vector`. Writing memory needs its own table with model and dimension tracking (PRD FR-MEM-005, FR-LOCAL-006). |
| LLM | OpenAI through raw `fetch` in `src/lib/ai/gemini.ts` (the filename is misleading). Default model `gpt-4o-mini`. `streamChatResponse` only fakes streaming. Three more routes call OpenAI directly. | There is no provider abstraction yet. This becomes the seam for the model adapter (ENG-007). |
| Usage tracking | `token_usage` table (daily per model and operation) | Extend it for per-run cost and budget enforcement (FR-AGENT-005). |
| Auth | One admin. The HMAC-signed `session` cookie is checked by `requireAuth()`, with credentials from env. Middleware guards `/admin` and `/api/admin`. | `owner_id` = admin email. No RBAC work needed. New APIs should live under `/api/admin/writing/*` so the existing middleware covers them. |
| Hosting | Vercel (serverless functions) with Vercel Blob (used for photos) | Function time limits rule out long in-process agent loops. Runs need checkpointing (see D4). |
| Tests | Playwright config plus **one trivial test**. No unit test runner. | Test infrastructure is M1 work (D10). |

### 1.2 How Thoughts works today
- **Storage:** Thoughts reuses the `stories` table, which was built for STAR career stories. The post body is HTML in the `action` column, the excerpt is `summary`, and state is a boolean `is_published`. The `situation`, `task`, `result` and `lessons_learned` columns are written as empty strings.
- **Admin UI:** `src/app/admin/stories/page.tsx` is a list with a modal editor. `PUT` overwrites every field. There's no zod validation, no revision check, no autosave and no history.
- **Public rendering:** `/volunteer` and `/volunteer/[slug]` (`src/app/(public)/volunteer/…`). The naming is legacy, but the header nav labels it "Thoughts" and the sitemap lists it. The page also renders the legacy STAR sections when they're present.
- **No separate published snapshot.** Editing a published post changes the live page as soon as you save (violates FR-PUB-004).

### 1.3 Defects to fix before (or in) M1
These are live issues. They get worse once AI-generated drafts and private ideas start landing in the database.

| # | Issue | Where | Severity |
|---|---|---|---|
| B1 | **Drafts leak to the public chatbot.** `syncEntityToRAG("story", …)` runs on every create and update, and `syncAllToRAG` syncs *all* stories. None of these filter on `isPublished`, so unpublished post bodies (raw HTML) become retrievable context for the public `/chat`. | `api/admin/stories/*`, `lib/rag/sync.ts:440` | **High** |
| B2 | **Unsanitized HTML on public pages.** `dangerouslySetInnerHTML={{ __html: story.action }}`. Pasted or AI-produced markup reaches the public site unfiltered. | `volunteer/[slug]/page.tsx` | High |
| B3 | **Slug is regenerated on every title edit, including for published posts.** Renaming a post silently breaks its URL. A slug collision returns an opaque 500. | `admin/stories/page.tsx` title `onChange` | Medium (FR-PUB-005) |
| B4 | Last write wins with no revision check. Two tabs open on the same post can clobber each other. | `PUT /api/admin/stories/[id]` | Medium |
| B5 | Images can only be inserted by URL prompt. Uploads, alt text and media metadata aren't supported. | editor toolbar | Low (FR-DOC-002) |

---

## 2. Recommended architecture (ADR summary)

**Decision: keep `stories` as the published-snapshot store and add a private writing workspace beside it.**

```
Admin Writing Studio (Tiptap, JSON canonical)
        │  autosave (revision CAS)
        ▼
writing_documents ──< writing_revisions        ideas, suggestions, agent_runs/events,
        │                                       preferences, samples, feedback, sources
        │  publish (explicit, idempotent): sanitize → render HTML → upsert
        ▼
stories  (existing table = live public snapshot)  →  /volunteer/[slug], sitemap, RAG (published only)
```

Why this shape:
- **The public site doesn't change.** The public pages, sitemap and chatbot keep reading `stories`. This meets the PRD rule "no competing public content store" (§10) and keeps FR-PUB-006 legacy compatibility.
- **A separate snapshot falls out for free (FR-PUB-004).** Drafts live in `writing_documents`. `stories` only changes when you publish.
- **Rollback is trivial.** The old modal editor keeps working against `stories` behind a feature flag in `site_settings` (PRD §23 step 3).
- **The migration is additive.** For each story, create a `writing_document` (`legacy_story_id` FK). Convert HTML to Tiptap JSON server-side with `@tiptap/html` `generateJSON` using the same extension set, and keep the original HTML in revision 1 (`content_html_legacy`). Nothing is dropped.
- **Name collision:** a `documents` table already exists (RAG uploads). Prefix every new table with `writing_`.

Module layout (in the existing app):
```
src/lib/writing/            domain: documents, revisions, publish, export (no LLM imports)
src/lib/writing/schema.ts   new drizzle tables (re-exported from lib/db/schema)
src/lib/llm/                provider contract + adapters (openai.ts, later ollama.ts / openai-compatible.ts)
src/lib/agent/              run state machine, tools registry + allowlist, budgets, approvals
src/lib/writing/prompts/    versioned .md prompts (system, workflows, style) — hash = prompt_version
src/app/admin/stories/...   studio routes (keep /admin/stories as the entry point)
src/app/api/admin/writing/  APIs from PRD §13 (under /api/admin so existing middleware applies)
```

**LLM contract** (`src/lib/llm/types.ts`): `generate`, `stream` (an AsyncIterable of deltas), `generateObject<T>(zodSchema)` with bounded repair retries, `embed`, `capabilities()`, typed errors (`timeout | rate_limited | context_overflow | provider_error`), `usage`, and AbortSignal support. Phase 1 uses one OpenAI adapter. Both Ollama and vLLM expose OpenAI-compatible endpoints, so most of the Phase 2 adapter is an "OpenAI-compatible" adapter with a different base URL and a capability matrix. Existing `gemini.ts` callers move onto the adapter opportunistically, not as a blocker.

---

## 3. Data model (additive)

| Table | Key columns | Notes |
|---|---|---|
| `writing_documents` | id, owner_email, title, slug (nullable until publish), excerpt, status enum (IDEA…ARCHIVED), body_json, current_revision int, published_revision int null, legacy_story_id → stories, published_story_id → stories, tags[], seo jsonb, timestamps | `current_revision` is the compare-and-swap (CAS) token |
| `writing_revisions` | id, document_id, revision_number, content_json, title, excerpt, change_origin (`autosave|manual|ai_accept|restore|publish|import`), suggestion_id, created_at | Snapshot policy: see D7 |
| `writing_ideas` | id, content (immutable original), tags, status, linked_document_id | FR-IDEA-001 |
| `writing_suggestions` | id, document_id, base_revision, anchor jsonb (node id + offsets), original, proposal, operation, status, run_id | FR-AI-002 |
| `writing_agent_runs` / `writing_agent_events` | run: workflow, status, model, provider, prompt_version, budget jsonb, usage jsonb, error. Events: seq, type, payload (redacted) | FR-AGENT-001/006 |
| `writing_approvals` | run_id, scope, approved_by, approved_at, idempotency_key | FR-AGENT-003 |
| `writing_conversations` / `writing_messages` | per-document chat | FR-AI-005 |
| `writing_preferences` | scope, rule, evidence jsonb, status, version, approved_at | FR-MEM-002/004 |
| `writing_samples` | content, source, approved, enabled | FR-MEM-001 |
| `writing_feedback` | suggestion_id, action, original, final | FR-MEM-003 |
| `writing_sources` | document_id, url, title, publisher, author, retrieved_at, excerpt/evidence, content_hash, status | FR-RES-002 |
| `writing_embeddings` | owner_type, owner_id, model, dims, `embedding vector` (untyped), index_version | Rebuildable. Supports dual indexes for the Phase 2 swap. |
| `writing_idempotency_keys` | key, route, response, created_at | FR-AGENT-007 |
| `slug_redirects` | old_slug → story_id | Only if D2 or slug edits are allowed |

Model configuration lives in `site_settings` (non-secret: provider, model id, per-task routing, budgets). Secrets stay in env vars only.

---

## 4. Development plan

Estimates assume one developer working with a coding agent. They replace the PRD §19 figures now that discovery is done: M1 shrinks because Tiptap already exists, and M3 grows because of serverless durability.

### M0 — Hotfixes and groundwork (2–3 days, can ship independently)
- B1: sync only published stories to RAG, and remove a story's chunks when it's unpublished. Strip HTML before embedding.
- B2: sanitize on render with `sanitize-html` or `isomorphic-dompurify`, using a Tiptap-matching allowlist.
- B3: lock the slug once a post is published (explicit "change URL" action); return 409 with a message on collision.
- Add zod validation to the stories APIs.
- Add **Vitest** for unit tests and a **Neon branch DB** for integration tests (D10). Capture **legacy post fixtures** by exporting the current `stories` rows (needs DB access).
- Write `docs/writing-studio/ADR-001-architecture.md` (section 2 of this doc, formalized).

### M1 — Foundation: editor, autosave, versions, legacy compatibility (≈1.5–2 weeks)
- ENG-002/006: drizzle migration for the `writing_*` tables. Write an **import script** (stories → writing_documents) with a round-trip test: HTML → JSON → HTML must match on every fixture, including lists, links, images, headings and the legacy STAR fields. Phase gate: no cutover until this passes.
- ENG-003: full-page editor at `/admin/stories/[id]/edit` with a three-region layout: left rail, central canvas, and a collapsible right pane that becomes a drawer on mobile. Reuse the current Tiptap config. Add Blockquote/HorizontalRule from StarterKit, Blob image upload with alt text, sanitized paste, and a word count. Give block nodes stable IDs (needed for M2 anchors).
- ENG-004: autosave with a 1.5 s debounce. `PATCH` sends `baseRevision`; the server runs `UPDATE … WHERE current_revision = $base`. A 409 response shows a conflict banner offering to reload or keep a local copy. Keep a localStorage draft as a crash buffer, and warn on `beforeunload`. Show a saving/saved/error indicator.
- ENG-005: version list, preview, and restore. Restoring writes a new revision.
- Publish v1 (FR-PUB-001…006 basics): a preview route that uses the same renderer as public, a metadata panel (title, slug, excerpt, tags, date), and an explicit Publish dialog. Publish sanitizes, renders HTML, upserts `stories`, and records `published_revision` plus an audit event, using an idempotency key. Published posts get a separate working draft.
- Documents list replacing the table: filters (state, tags), search on title/body, sort.
- Feature flag `writing_studio_enabled` with the old modal kept as fallback.
- E2E: create → autosave → reload → publish → public page shows the content; edit published → public unchanged until republish.

### M2 — GPT editing (≈1 week)
- ENG-007/008: `src/lib/llm` contract, OpenAI adapter (streaming over SSE, structured output via JSON schema from zod, timeouts and abort), and contract tests with a recorded or mock provider.
- Budget guard: per-request token caps, a daily and monthly spend cap enforced from `token_usage` (cost column added), and a kill switch in settings.
- ENG-010: selection toolbar (rewrite, shorten, expand, simplify, grammar, tone, critique) → `POST /ai/rewrite` → `writing_suggestions` row anchored to node IDs plus base revision → paragraph-level diff card → accept applies a single Tiptap transaction (so undo works) and writes an `ai_accept` revision. Reject or accept also writes `writing_feedback`. A stale base revision is rejected.
- ENG-009: right pane with a streamed "writing partner" chat on a persisted per-document conversation, and a **context inspector** showing exactly what was sent (FR-AI-001).
- Prompt files plus prompt-assembly unit tests, following the PRD §14 order. Retrieved and document content is fenced as data.

### M3 — Agent workflows (≈2 weeks)
- ENG-011: run state machine (CREATED → PLANNING → RUNNING → WAITING_FOR_APPROVAL → COMPLETED / FAILED / CANCELLED). Every step is idempotent and checkpointed to `writing_agent_events`. Steps run under the chosen runner (D4). The UI polls or uses SSE for events, and runs can be cancelled.
- ENG-015: tool registry with a server-side allowlist per workflow. Approval-gated tools (`publish`, `replace_document`, `delete`) can't run without a `writing_approvals` row created by an authenticated UI click. The model can only *request* them.
- WF-001 Idea → Outline (idea inbox, quick capture, converting an idea keeps the original), WF-002 Outline → Draft (proposal inserted only on accept), WF-004 Editorial Review (findings anchored to passages, dismissible, kept separate from fact verification).
- ENG-013 WF-003 Research: search provider (D5), then server-side fetch, readable-text extraction, and a `writing_sources` record with retrieved_at and content hash. Synthesis only cites stored source IDs. An unsupported claim is flagged and a source is never invented. Fetched content is untrusted: no tool calls are derived from page text.
- WF-005 Publication prep: suggests title, excerpt, slug and tags, validates them, and hands off to the M1 publish dialog. Publishing stays a human click.

### M4 — Writing memory (≈1 week)
- Samples library (import from published posts with one click, enable/disable), a versioned style profile (global plus per audience, with a defined precedence), and a feedback timeline.
- Preference proposals: a periodic or on-demand job mines `writing_feedback`, proposes rules with evidence links, and detects duplicates and conflicts. Nothing becomes active without approval.
- Embeddings in `writing_embeddings` (model and dims recorded) for sample retrieval. A rebuild script is included.

### M5 — Harden and release (≈1–1.5 weeks)
- ENG-020: export ZIP (jszip is already a dependency) containing a manifest, documents as JSON plus Markdown, revisions, ideas, sources, preferences, samples, prompts, feedback CSV, and media references.
- ENG-021: 40-case evaluation harness (PRD §18) as a script that writes outputs side by side for blind rating, stored for later GPT-vs-local comparison.
- ENG-022: security tests (prompt-injection fixtures in research pages, cross-record access, XSS payloads in the body and paste, spend exhaustion, approval bypass), plus backup and restore drill (Neon point-in-time restore), observability (run duration, failures, cost, acceptance rate on the existing analytics page), and a privacy note in the UI.
- Owner-only beta → flip the flag → remove the old modal after 2–4 weeks of stability.

### Phase 2 — Local LLM (M6–M8, ≈3–4 weeks after Phase 1, gated on hardware)
- M6: Ollama on owner hardware, reachable only through a private authenticated tunnel (D12). Add an OpenAI-compatible adapter and a per-task model router in settings.
- M7: shadow evaluation on the 40-case suite. Test JSON and tool reliability per model, and run a dual-index embedding migration if local embeddings are wanted.
- M8: switch defaults per task only after the 85% gate. Cloud fallback is explicit and logged, and never silent in privacy mode. Verify that no external inference calls happen once cloud is disabled.

---

## 5. Decisions needed (with recommendations)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | Data model strategy | (a) New `writing_*` tables, with `stories` kept as the published snapshot; (b) extend `stories` in place | **(a)**. Additive, keeps the public site untouched, gives instant rollback, and separates drafts from live content. |
| **D2** | Public URL | Keep `/volunteer/[slug]`, or move to `/thoughts/[slug]` with 301s from `/volunteer/*` | **Move to `/thoughts`** with permanent redirects. Cheap, fixes the naming, and keeps SEO. Your call because it's a public URL change. |
| **D3** | Legacy STAR fields on existing posts | Fold `situation`/`task`/`result`/`lessons` into the body during import, or keep rendering them as separate sections | Depends on the data (needs DB access to count). If few posts use them, **fold them into the body** as headed sections. |
| **D4** | Agent runner on Vercel | (a) DB-checkpointed steps executed by route handlers (`maxDuration` ≈ 300 s per step, resumed by re-entry); (b) Inngest; (c) Vercel Workflow / Queues | **(a)** for M3. No new vendor, and the workflows are short. Move to (b) or (c) only if research runs regularly exceed one function's lifetime. |
| **D5** | Research provider | Tavily / Exa / Brave Search API plus your own fetch, or OpenAI hosted web search | **A separate search API (Tavily or Brave)**. Hosted search ties research to OpenAI and won't carry over to Phase 2. It also costs money: decide a monthly cap. |
| **D6** | GPT models and budget | Model per task tier (fast rewrite vs drafting/critique), and monthly $ cap | Two tiers configured in settings, not hard-coded. Pick the current models when M2 starts (check pricing then). Suggested default cap: **$20/month** with a hard stop. |
| **D7** | Revision snapshot policy | Snapshot every autosave, or snapshot on events | **Event-based**: on manual save, AI accept, restore and publish, plus at most one autosave snapshot every 5 min of active editing. The working copy updates in place, with the revision CAS on every save. |
| **D8** | Suggestion UX | (a) Paragraph diff cards in the right pane with an inline highlight; (b) full inline track-changes | **(a)** in M2 (simpler, robust on 20k words). Consider (b) later. Avoid Tiptap's paid AI/collab extensions so you stay independent of them. |
| **D9** | DB driver for writing module | Stay on neon-http (CAS + `db.batch`), or add the Neon WebSocket `Pool` for real transactions | **Add `Pool`** for `src/lib/writing` only. Publishing touches three tables and needs atomicity. |
| **D10** | Test infrastructure | Vitest + Playwright against a Neon branch DB, or mocked DB only | **Vitest + a Neon branch DB** (free tier supports branches). Trim Playwright to Chromium for speed. |
| **D11** | Public chatbot and Thoughts | Should published Thoughts feed the public `/chat` RAG at all? Should ideas and drafts ever? | Published posts: **yes** (current intent). Drafts, ideas, research and memory: **never**. Enforced by B1 and by keeping `writing_*` out of `lib/rag`. |
| **D12** | Phase 2 hosting and ingress | Hardware (GPU/VRAM); ingress from Vercel to the home box: Cloudflare Tunnel + Access service token, Tailscale Funnel + auth header, or self-hosting the backend inside the tailnet | **Cloudflare Tunnel + Access service token**. Works from serverless, keeps the server off the public internet, and adds no inbound ports. Hardware can be decided later; it doesn't block Phase 1. |
| **D13** | Scope cuts for a faster Phase 1 | Defer FR-AI-005 conversations, FR-MEM-004 proposals, or WF-003 research to "Phase 1.5" | If you want value sooner, **ship M1+M2 first (≈3 weeks)**, then reassess. Most of the day-to-day value sits in the editor plus inline AI edits. |
| **D14** | Next.js upgrade | Stay on 14, or upgrade to 15 first | **Stay on 14** for this project. Don't couple a framework upgrade to a feature rewrite. |

---

## 6. Requirement traceability (abbreviated)
| Milestone | PRD requirements |
|---|---|
| M0 | FR-PUB-005 (partial), §17 sanitization, privacy (B1) |
| M1 | FR-DOC-001…005, FR-PUB-001…007, FR-IDEA-001 (capture), FR-AGENT-007 (publish idempotency) |
| M2 | FR-AI-001, FR-AI-002, FR-AI-005, FR-AGENT-005, FR-LOCAL-003/004 contract groundwork |
| M3 | FR-IDEA-002, FR-AI-003, FR-AI-004, FR-RES-001…004, FR-AGENT-001…006 |
| M4 | FR-MEM-001…004 |
| M5 | FR-MEM-005, §16 NFRs, §18 evaluation, §22 portability |
| M6–M8 | FR-LOCAL-001…008 |

## 7. Things I couldn't verify (no DB/production access here)
- How many posts exist, and whether any use the STAR columns or embedded media (affects D3 and the fixtures).
- The real Vercel plan, and therefore function `maxDuration` limits (affects D4).
- Whether Neon point-in-time restore is enabled on the current plan (backup and rollback evidence).
