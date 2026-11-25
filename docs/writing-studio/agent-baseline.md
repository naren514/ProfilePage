# Agent baseline (A0)

Measured before any agent changes, so later phases can show they improved
things. See [the implementation plan](agent-implementation-plan.md) §2.

## 1. Eval set: today's workflows (mock mode, the CI baseline)

`npm run agent:eval -- --mode mock` on 2026-11-21. The goals are in
`tests/agent-eval/goals.json`, the checks in `scripts/agent/checks.ts`, and
the stored baseline in `tests/agent-eval/baseline.json`.

| Scenario | Tasks | Scored | Pass rate |
| --- | --- | --- | --- |
| Goal to draft (explore, then a draft) | 5 | 5 | 100% |
| Fact-check before publish (research) | 5 | 5 | 100% |
| Style learning (learn from feedback) | 5 | 5 | 100% |
| Reading-list digest | 5 | 5 | 100% (since A1; unsupported at A0) |
| Stale post refresh | 5 | 0 | unsupported (A3) |
| Weekly reading list | 5 | 0 | unsupported (A3) |

The gate for A0 is met: today's workflows score on the eval set. What mock
mode proves:

- **The plumbing, not the quality.** Runs complete, stop at the right
  checkpoints and stay within budget.
- **Citations.** Facts cite retrieved sources.
- **Prompt injection.** Hostile text in search results, pasted notes and
  feedback never reaches the output.

Quality needs the real-model run below.

## 2. Eval set with real models (to do: needs your key)

Run **Actions → Agent eval (real models) → Run workflow**. This needs the
repository secret `OPENAI_API_KEY`. Alternatively, run it locally against a
scratch database:

```bash
npm run agent:eval -- --mode real --model gpt-4o-mini,gpt-6.2-sol --yes
```

It replays the recorded web fixtures, so only the model varies. It adds a model
grader (`scripts/agent/grader.ts`, rubric: grounded, useful, style, gate,
safety). Spot-check a few results against your own judgement before trusting
the grader.

| Scenario | Rule pass rate | Mean grader score | Your spot check |
| --- | --- | --- | --- |
| Goal to draft | | | |
| Fact-check | | | |
| Style learning | | | |

## 3. Production metrics (to do: needs production access)

The PRD's five success metrics come from your real runs. Run the script
read-only against production:

```bash
DATABASE_URL=<production URL> npm run agent:baseline -- --days 90
```

Then paste the table here. The same numbers are on the Studio's Activity page
under **Agent goals**.

| Metric | Baseline | Target |
| --- | --- | --- |
| Runs started by a schedule or event | | ≥ 50% (0% today by design: every run is a click) |
| Runs finished within budget | | ≥ 90% |
| Final proposals accepted (whole or edited) | | ≥ 70% |
| Research facts left unsupported | | ≤ 5% |
| Runs stopped by a loop or tool error | | ≤ 5% |

## 4. A2 gate: the Research agent against scripted Research

The gate: on Research tasks, the agent matches or beats the scripted workflow, at no more than 1.5× the cost. Compare by running the same goals both ways:

```bash
npm run agent:eval -- --mode mock --only fact_check                                   # scripted
npm run agent:eval -- --mode mock --only fact_check --swap research=research_agent    # agent
```

**Mock mode, 2026-11-23** (plumbing and safety only: the mock plays a well-behaved agent):

| | Scripted Research | Research agent |
| --- | --- | --- |
| Fact-check tasks passed | 5/5 | 5/5 |
| Cost for the 5 tasks | $0.082 | $0.099 (1.2×) |
| Prompt-injection task (fcp-05) | passed | passed |

On the thin-sources task (fcp-04), the agent searched a second time with different words before proposing. That extra search is most of the cost difference.

**Real models, 2026-11-25** (GitHub Actions, "Agent eval (real models)", `--only fact_check`, fast + quality models, replayed web):

| | Scripted Research | Research agent (first run) |
| --- | --- | --- |
| Fact-check tasks passed | 5/5 | 4/5 |
| Cost for the 5 tasks | $0.259 | $0.266 (1.03×) |

The miss was fcp-04 (thin sources): the agent kept searching, found nothing new, and hit the no-progress stop without proposing anything, where scripted Research reports thin findings. Fix: one turn before that stop, the loop now tells the agent to propose what it has and say the sources are thin. The real-model run was repeated after the fix.

**After the fix, 2026-11-25** (same setup, commit a37c41c):

| | Scripted Research | Research agent |
| --- | --- | --- |
| Fact-check tasks passed | 5/5 | 5/5 |
| Cost for the 5 tasks | $0.259 | $0.184 (0.71×) |

**A2 gate: passed.** The agent matches scripted Research on every fact-check task, at less than its cost. Real-model costs vary from run to run (the first agent run cost $0.266), so the weekly real-model eval keeps watching both.
