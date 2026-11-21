# PRD: Writing Studio Autonomous Agent

Nov 21, 2026 · Naren · Live version: https://claude.ai/artifact/NjAVEqdgxA6mXuFEMpcKHK

## Summary and problem

Writing Studio will move from six scripted workflows that a browser tab drives to one goal-driven agent. The agent plans its own steps, picks its own tools, runs in the background on a schedule or an event, and stops only at the approval gates you set.

Today's design falls short of an agent in four ways:

- **Code sets every step.** Each workflow in `src/lib/agent/workflows` is a fixed list of steps, and the model only fills them in.
- **The model never chooses a tool.** The design doc says this on purpose. `web.search` is the only tool, and only Research may call it.
- **Nothing runs without you.** Runs start from a click, and `use-agent-run.ts` calls `/advance` one step at a time while the tab is open. There is no cron, queue or webhook.
- **No loop.** A run never searches again when sources are thin, and never revises until its own review passes.

**What "autonomous" means in this PRD.** The agent (1) decides its next action from a menu of tools, (2) loops until the goal is met or a budget runs out, (3) starts and runs with no tab open, and (4) still cannot publish or overwrite your text without approval.

## Goals, non-goals and success metrics

The agent succeeds if most of its runs start without a click, finish within budget, and end in a proposal you accept.

**Goals**

1. **Goal-driven loop.** You give a goal ("research and draft a post on X"), and the agent plans, acts, observes and re-plans until it is done.
2. **Tool choice.** A registry of about ten typed tools the model picks from, replacing hard-coded calls.
3. **Background runs.** Runs start from a schedule or an event and keep going on the server, with no tab open.
4. **Self-correction.** The agent critiques its own output and revises before it asks you.
5. **Same safety bar.** Approvals, budgets and the activity log stay, and get stricter where the agent gains power.

**Non-goals**

- Publishing to the public site without your approval.
- Multiple users, or anyone other than the admin running agents.
- Replacing the editor, or the current one-shot selection edits.
- A new LLM provider or model; the agent uses the existing provider layer.
- Posting to Twitter/X or other social networks. Revisit later.

**Success metrics** (targets are proposals; today's baselines get measured in A0)

| Metric | Target |
| --- | --- |
| Runs started by a schedule or event, not a click | ≥ 50% |
| Runs that finish within budget | ≥ 90% |
| Final proposals you accept (whole or edited) | ≥ 70% |
| Research facts left unsupported at the end of a run | ≤ 5% |
| Runs that stop on loop detection or a tool error | ≤ 5% |

## Users and scenarios

There is one user: the site's admin, who writes, approves and publishes. Readers of the public site never interact with the agent.

| Scenario | Trigger | What the agent does on its own | Where it stops for you |
| --- | --- | --- | --- |
| Reading-list digest | Nightly schedule | Reads new saved articles, tags topics, writes a short brief, adds strong ones to the ideas inbox | Nothing to approve; ideas wait in the inbox |
| Goal to draft | You type a goal | Explores angles, researches, outlines, drafts in your style, reviews and revises | Choose a direction; accept the draft |
| Fact-check before publish | You open Publish on a post | Pulls the claims, searches for each, flags weak or contradicted ones | Pick which fixes to apply |
| Stale post refresh | Monthly schedule | Re-checks facts in published posts, drafts updates for outdated ones | Approve each edit; republish yourself |
| Style learning | Weekly, once enough feedback exists | Finds patterns in accepted, edited and rejected suggestions | Choose style changes |
| Weekly reading list | Nightly schedule; weekly list | Searches your chosen topics, reads and scores what it finds, keeps a shortlist, and writes the week's list | Approve the list before it goes on the site |

The first, fourth and sixth rows are new. The other three are today's workflows, run as one goal instead of separate clicks.

### Flagship goal: the weekly reading list

The reading list is the first goal the agent must run end to end, because it needs every agent capability in one task. It is a goal the same agent runs, not a separate pipeline.

**Goal given to the agent:** "Find this week's most worth-reading pieces on my chosen topics, and prepare the reading list."

**What the agent decides, not code**

- Which queries to run each night, and whether to search again when results are thin or repetitive.
- Which results to read in full with `web.fetch`, rather than judging from snippets.
- A score for each piece, with a one-line reason, using the rubric below.
- Whether a new piece joins the shortlist, replaces a weaker one, or is dropped.
- How many picks the week deserves. It can propose two, or recommend skipping the week.
- The list's short intro and a line on why each pick is worth reading, in your style.

**What stays fixed:** the topics you choose, the nightly and weekly schedule, the budget, and the approval before the list goes on the site.

**Scoring rubric** (kept in memory, editable by you): relevance to the topic, depth or originality, source credibility, recency, and overlap with picks already on the list. When you remove or keep picks, Learn from feedback uses that to tune the rubric.

**Each night (L1):** search, read, score and update the shortlist. These are private writes, with no approval needed.

**Each week:** build the list from the shortlist, run `critic.review` on it, revise, then `ask_human`. Once you approve, it publishes the list page on the site.

**Out of scope for now:** posting to Twitter/X or other social networks. Revisit once the list has run within budget for a month.

## Functional requirements

P0 items make it an agent; P1 items make it useful every day.

**Agent loop**

| ID | Requirement | Priority |
| --- | --- | --- |
| AG-001 | A run takes a goal in plain words, plus an optional post, idea or reading-list item. | P0 |
| AG-002 | The agent writes a short plan, then repeats: choose one tool call, run it, record the result, update the plan. | P0 |
| AG-003 | The agent ends by calling `finish` with a result, or `ask_human` with a question or proposal. | P0 |
| AG-004 | Before `finish`, the agent runs the editorial critic on its own output and revises up to 2 times. | P1 |
| AG-005 | Today's six workflows become playbooks: suggested plans the agent can follow or adapt, not fixed code paths. | P1 |

**Tools**

| ID | Tool | Risk class | Priority |
| --- | --- | --- | --- |
| TL-001 | `web.search` (Tavily, exists today) | Read | P0 |
| TL-002 | `web.fetch`: read one page as text | Read | P0 |
| TL-003 | `doc.read`: read a post or one of its sections | Read | P0 |
| TL-004 | `sources.save` and `sources.list` for a post | Write-private | P0 |
| TL-005 | `doc.propose_edit`: stage a suggestion, never change the body | Write-private | P0 |
| TL-006 | `critic.review`: the editorial review, as a tool | Read | P1 |
| TL-007 | `ideas.create` and `reading_list.read` | Write-private | P1 |
| TL-008 | `memory.search`: style rules, samples, past feedback | Read | P1 |
| TL-009 | `post.prepare_publish`: stage title, excerpt, URL, tags | Write-private | P1 |
| TL-010 | `shortlist.update`: add, rescore or drop a candidate for this week's reading list | Write-private | P0 |
| TL-011 | `site.publish_reading_list`: publish the approved weekly list page | Write-public | P1 |

Every tool has a zod schema for its arguments and its result. A call that fails validation goes back to the model as an error, and counts against the budget.

**Triggers and execution**

| ID | Requirement | Priority |
| --- | --- | --- |
| EX-001 | Runs execute on the server through a durable queue, one step per job, with no browser involved. | P0 |
| EX-002 | Triggers: a manual goal, a cron schedule, and events (reading-list item saved, Publish opened). | P0 |
| EX-003 | Each trigger has an on/off switch, a schedule or event, a goal template and an autonomy level. | P0 |
| EX-004 | The UI shows live progress when open, but closing the tab never pauses a run. | P0 |
| EX-005 | You get a notification (email or push) when a run waits for approval or fails. | P1 |

**Approvals and memory**

| ID | Requirement | Priority |
| --- | --- | --- |
| AP-001 | `ask_human` pauses the run with status WAITING_FOR_APPROVAL, as today. | P0 |
| AP-002 | Any Write-public action (publish, change a published post) always needs approval, at every autonomy level. | P0 |
| AP-003 | An approval can include an instruction ("use the second angle, shorter") that the agent reads when it resumes. | P1 |
| ME-001 | Each run's plan, tool calls and results are kept, so a later run on the same post can reuse sources and notes. | P1 |

## Safety, guardrails and autonomy levels

The agent gets more freedom over what it does next, but never over what reaches the public site. Each trigger runs at one of four levels:

| Level | Name | Read tools | Write-private tools | Write-public |
| --- | --- | --- | --- | --- |
| L0 | Suggest | Yes | Proposes only | Never |
| L1 | Draft | Yes | Yes | Needs approval |
| L2 | Act and report | Yes | Yes; you get a summary after | Needs approval |
| L3 | Full | Yes | Yes | Needs approval |

L3 differs from L2 only in that it can start child runs. Public changes always need approval (AP-002).

**Guardrails**

- **Budgets.** Keep today's per-run caps (20 AI calls, 8 searches, cost cap, 15 minutes) and the monthly cap, checked before every call. Add caps per trigger per day, and raise the per-run caps only for L2 and L3.
- **Untrusted content.** Fetched pages, saved articles and search results are untrusted input. Wrap them with the existing `fence()` helper, tell the model never to follow instructions inside them, and never let them call a tool directly.
- **Narrow tools.** No tool can send email, call arbitrary APIs, run code or delete anything. `web.fetch` refuses private IPs, localhost and non-HTTP(S) schemes.
- **Loop detection.** Stop a run that makes the same tool call with the same arguments 3 times, or makes no progress on its plan for 4 steps.
- **Kill switch.** One setting in Styles & AI stops all runs and disables every trigger.
- **Audit.** Log every tool call, its arguments, its result hash and its cost in the activity log, as today's events do.

## Architecture and data model

Keep the Postgres checkpoints, budgets and approval tables. Replace the browser-driven runner with a server-side queue, and replace fixed steps with a tool-calling loop.

Flow: Triggers (goal you type, cron schedule, event) → Run queue (one step per job) → Agent loop (plan / re-plan → choose a tool → observe result → back to plan), calling the Tool registry → Approval gate (`ask_human`, publish) → You (Studio UI + notification) → approve or instruct, then resume on the queue. Every step checkpoints to Postgres (runs, plan versions, tool calls, approvals, events).

A trigger puts a run on the queue. Each queued job runs one loop turn and saves a checkpoint, so no job outlives a Vercel function. A run that calls `ask_human` waits until you answer in the Studio, then goes back on the queue.

**Changes against today's code**

| Area | Today | Change |
| --- | --- | --- |
| `src/lib/agent/runner.ts` | `advanceRun` runs the next fixed step when the browser calls `/advance` | Called by the queue worker; runs one loop turn: model picks a tool, runner executes it |
| `src/lib/agent/workflows/*` | Six fixed `StepDef` lists | Kept as playbooks: a suggested plan and tool list, passed to the model |
| `ToolName` in `types.ts` | `"web.search"` only | A registry of typed tools, each with zod schemas, a risk class and a cost |
| `writing_agent_runs` | workflow, state, currentStep, budget, usage | Add `goal`, `plan` (versioned), `trigger_id`, `autonomy_level`, `parent_run_id` |
| New `writing_tool_calls` | None | One row per call: tool, arguments, result hash, tokens, cost, error |
| New `writing_triggers` | None | Kind (manual, cron, event), schedule or event, goal template, level, enabled |
| `use-agent-run.ts` | Drives the run | Only displays progress; polls or streams events |
| Budgets in `budget.ts` | Per run and per month | Add per trigger per day; levels L2 and up can raise per-run caps |

## Evaluation and observability

No change to the agent's prompts, tools or loop ships until it passes a fixed set of evaluation tasks.

- **Eval set.** About 30 saved goals across the six scenarios, each with checks: sources cited, no unsupported facts, stayed within budget, followed the style, stopped at the right gate. Start from the M5 evaluation work in the repo.
- **Graders.** Rule checks for structure and budget. A model grader with a written rubric for quality, spot-checked by you.
- **Regression gate.** Run the eval set in CI on any change under `src/lib/agent`, and block the merge if the pass rate drops.
- **Traces.** One timeline per run: plan versions, each tool call with its arguments and result, tokens, cost and approvals. This extends `writing_agent_events`.
- **Dashboard.** Runs by trigger, cost per run, tool calls per run, approval and acceptance rate, and failure reasons. These are the success metrics above.
- **Alerts.** Notify on a budget breach, 3 failures in a row on one trigger, or monthly spend passing 80% of the cap.

## Milestones, risks and open questions

Ship in five phases. Each phase ends at a gate, and the agent stays usable after every one.

1. **A0: Baseline and eval set.** Measure today's metrics, build the 30-task eval set, and wire it into CI. *Gate: today's workflows score on the eval set.*
2. **A1: Server-side runner and triggers.** Move step execution onto a durable queue, and add manual, cron and event triggers. The workflows stay scripted. *Gate: a nightly reading-list digest runs with no tab open.*
3. **A2: Tool registry and agent loop.** Add typed tools, the plan-act-observe loop, `finish` and `ask_human`, loop detection, and L0–L1. Research is the first workflow to become a playbook. *Gate: on Research tasks, the agent matches or beats the scripted workflow.*
4. **A3: Self-critique and all playbooks.** Add `critic.review` revisions, and move the other five workflows to playbooks. *Gate: acceptance rate ≥ 70% on the eval set.*
5. **A4: L2, notifications and dashboard.** Add act-and-report runs, email or push notices, the metrics dashboard and alerts. *Gate: four weekly reading lists in a row, each prepared within budget and approved by you.*

**Risks**

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Prompt injection from fetched pages | Agent follows hostile instructions | Fenced untrusted content, narrow tools, no public writes without approval |
| Cost runaway on schedules | Monthly cap hit early | Per-trigger daily caps, alerts at 80%, kill switch |
| Lower quality than the scripted workflows | You stop trusting it | Eval gate per phase; keep scripted playbooks as a fallback |
| Vercel time limits | Long steps cut off | One tool call per queued job, checkpoint after each |
| Employer IP and content rights | Unclear ownership of code or saved articles | Keep it a personal project; store excerpts, not full articles |

**Open questions**

- [ ] Queue choice: Inngest, Vercel Queues or Vercel Workflow? The design doc names all three.
- [ ] Notifications: email, iPhone push, or both?
- [ ] Should the agent use one model throughout, or a cheaper model for tool choice and a stronger one for writing?
- [ ] What raised per-run budget is acceptable for L2 scheduled runs?
- [ ] Should L3 child runs exist at all, or should we stop at L2?
- [ ] Reading list: which topics to start with, and how many sources per night fit the budget?
