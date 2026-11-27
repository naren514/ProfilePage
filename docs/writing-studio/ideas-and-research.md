# Reading → writing, and deep research

These agent features connect what you read to what you write. They follow the same rules as the other agents: everything is private until you choose to publish it, every run has a budget, and every run is recorded in AI → History.

## Related reading in the editor

The editor's side panel shows related articles under **Assistant → Sources → "From your reading"**.
- **What it lists:** up to five articles you saved, published or picked for a weekly list that relate to the post.
- **Why each one matched:** it shows the words they share, for example `shares "migration", "legacy"`.
- **Ranking:** plain TF-IDF similarity (`similarDocuments` in `src/lib/reading/taste.ts`), so it is free and instant.
- **Source:** adds the article to the post's source library, once. It is marked "From your reading".

The agents use the same ranking through a tool called `reading.related`. Research, agent research and deep research check your own reading before the web, and your articles become sources they can cite and read in full.

## Ideas from your reading (the idea miner)

**What it does.** The helper looks at the last 30 days of what you kept: articles you saved or published (with your notes) and articles you picked or added to the week. It then:
1. Groups related articles (`src/lib/reading/clusters.ts`, at least two per group).
2. Leaves out themes an existing idea, draft or post already covers.
3. Files two or three ideas in the Ideas column.

Each idea is an angle in plain words and shows **"From your reading · N articles"**. **Start writing** puts those articles in the new post's sources.

**How to run it:**
- **On demand:** **Find ideas in my reading** at the top of the Ideas column on the Thoughts board. It takes under a minute.
- **Weekly:** **"Find post ideas in my reading"** runs on Sundays. Find it in AI → Helpers. It starts switched off and costs at most $0.50 a run.
- **Repeats:** running it again doesn't repeat a theme whose articles already back an idea.

## Deep research

Ask a big question and get a reviewed report with citations that you can write from. It is modelled on Perplexity and the Deep Research products.

**Where to start it:**
- **AI → Deep research**, which also lists past research
- the **In depth** button next to Research in the editor's Workflows tab
- **Research this in depth** in an idea card's ⋯ menu
- "Deep research" in ⌘K

**What it does:**
1. **`research.plan`:** splits the question into 3–6 sub-questions. These are shown as the run's steps.
2. **`reading.related`:** checks your own reading first.
3. **Searches and reads:** searches for each sub-question and reads key pages in full. It looks for sources that disagree.
4. **`research.note`:** records findings per sub-question with their sources and a confidence (high, medium or low), so the context stays small over many turns.
5. **`research.report`:** writes the report. It is checked automatically:
   - every finding must cite a source it actually retrieved
   - every sub-question must be covered or listed as open
   - the report must rest on several sources
6. **Review:** an editor model reviews the report (at most two reviews) for unsupported claims, confidence that doesn't match the evidence, one-sided sources, and missing disagreements. The report is revised before you see it.

**What you get:**
- a summary
- a section per sub-question, where each finding is marked **Well supported**, **Fairly supported** or **Tentative**, with numbered citations
- where sources disagree
- open questions
- the source list

**What you can do with it:**
- **Before using it:** **Dig deeper** with a note, which keeps researching and comes back with an updated report, or **Stop here**.
- **After pressing Use this report:**
  - **Add to my post** (when started from the editor)
  - **Start a draft from this:** a new post, with the report's sources in its library
  - **Save as an idea:** with its sources

**Limits.** A run stops at **$2** by default. Change it under AI → Settings & cost → "Limit per deep research". It also stops at 14 searches, 20 pages read, 60 AI calls and 30 minutes of work. If it runs out of turns, it ends with its notes instead of failing. It keeps going on the server, so you can close the page.

## Tests and evals

- **E2E:** `tests/e2e/agent-ideas-research.cjs` (24 checks). `writing-studio-agent` covers related reading.
- **Unit:** clustering, report checks and the report HTML, in `tests/unit/agent-ideas-research.test.ts`.
- **Eval scenarios:**
  - `ideas_from_reading` (3 tasks), checked with `ideas_filed` and `ideas_cite_reading`
  - `deep_research` (2 tasks), checked with `report_cited`, `report_covers_plan` and `report_sources`
