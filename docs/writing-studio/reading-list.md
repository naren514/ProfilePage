# Reading list: saving articles from anywhere

The public **Reading** page (`/certifications`, "Worth your time") is fed by a
private inbox at **Admin → Reading**. Articles arrive three ways:

| From | How | Login needed |
| --- | --- | --- |
| iPhone / iPad | "Save to Reading" Shortcut in the share sheet | No (personal token) |
| Desktop browser | "+ Reading" bookmarklet opens a small save window | Yes (admin session) |
| Anywhere | Paste a link into the inbox | Yes |

Each save reads the page's title, source, author, date and image, removes
tracking parameters, follows short links (including LinkedIn's `lnkd.in`
interstitial), and merges duplicates of the same article.

## Publishing rule

When you send an article you choose **Keep private** (inbox) or **Publish now**.
Publishing uses only the note you typed. The AI suggests a note in your default
writing style, but it is kept separately and is never published unless you
press **Use**. No suggestion is made when the page couldn't be read, so the AI
never writes about a page it hasn't seen.

## Topics

Reading articles and Thoughts posts share one set of topics (tags).

- **Posts:** set tags in the Studio editor's Details panel, as before.
- **Reading:** add topics in the inbox or the save window. Type a topic and
  press Enter, or pick one of the topics you already use. The AI suggests one
  to three topics, preferring ones you already use. Suggestions show as dashed
  chips and are only applied when you click them. The token API also accepts
  `tags`.
- Spelling variants are the same topic: "Supply chain", "supply-chain" and
  "#supply chain" all go to `/topics/supply-chain`. The label shown is the
  wording you use most.

Public pages:

- `/topics` lists every topic with its post and article counts.
- `/topics/<topic>` shows "From my writing" (posts) and "Worth reading"
  (articles) for that topic, plus related topics.
- Thoughts, the Reading page and each post link their topics. The lists have
  a "Browse by topic" row, the footer links to Topics, and topic pages are in
  the sitemap.
- Only published posts and articles count. Inbox items and drafts never
  appear.

## One-time setup

Open Admin → Reading and choose **Set up now**. This runs the same idempotent
setup as the Writing Studio (`POST /api/admin/writing/setup`), adding to the
existing `certifications` table:

- `status` (`inbox`, `published` or `archived`; `is_active` mirrors `published`)
- `note`, `suggested_note`, `quote`, `image_url`, `site_name`, `author`,
  `saved_via`, `url_normalized` (unique), `saved_at`, `tags` and
  `suggested_tags`

If you ran setup before topics existed, the inbox asks for the update again.
Run it once more.

It also creates the `api_tokens` table. Existing entries stay published, and
their old excerpt becomes the note. Until setup has run, the public page keeps
working from the original columns.

## Phone: the Save app (recommended)

No Shortcuts needed. `/save` is a small web app you add to your home screen:

1. On your phone, open `https://<your site>/save` in Safari (Chrome on Android).
2. Tap **Share → Add to Home Screen → Add**.
3. Open **Save** from the home screen and tap **Connect this phone** (sign in if asked). This creates a personal reading token named "Home screen app", kept on the phone, so it keeps working after your admin login expires. Revoke it in Admin → Reading → settings (gear) → Ways to save to disconnect the phone.

To save: copy a link in any app, open **Save**, tap **Paste & save** (choose **Keep private** or **Publish now** first). You can also paste a link into the box. On Android the app appears in the share sheet and saves a shared link on arrival; `/save?url=…` does the same anywhere.

## iPhone Shortcut (alternative)

Build it once in the Shortcuts app. Find each action with the search field at
the bottom of the action list ("Search for apps and actions").

For either option:

1. Open **Shortcuts**, tap **+**, and name the shortcut `Save to Reading`.
2. Tap **ⓘ** (Details), turn on **Show in Share Sheet**, then in the
   "Receive **Any** input" block keep only **URLs** and **Safari web pages**.

### Option 1: open the save window (easiest, 2 actions, no token)

3. **Text**: `https://<your site>/reading-save?url=` followed by the
   **Shortcut Input** variable (tap it in the bar above the keyboard).
4. **Open URLs**.

It opens the same window as the desktop button, with the article details, a
suggested note and Keep private / Publish now. You need to be logged in to the
site in Safari; if you aren't, it asks you to log in and then comes back. You
don't need to encode the link, because parameters the article link brings with
it are put back together on the server.

### Option 2: save in the background (token)

3. Create a token in **Admin → Reading → settings (gear) → Ways to save** and copy it. Use
   **Copy as header value**, which gives `Bearer rd_…`. It is shown once, and
   only its SHA-256 hash is stored.
4. **Get Contents of URL**:
   - URL: `https://<your site>/api/reading/save?format=text`
   - Tap **›**: Method **POST**
   - **Headers**: `Authorization` = the copied value
   - **Request Body**: JSON, Text field `url` = **Shortcut Input**
5. **Show Notification** with **Contents of URL**. It shows "Saved: title — in
   your Reading inbox."

To choose each time, add **Choose from Menu** before step 4 with the options
`Keep private` and `Publish now`. Under each option, add a **Text** action with
the same words, then add a JSON field `publish` = **Menu Result**. A typed note
can go in a field `note`, using **Ask for Input**.

### API

`POST /api/reading/save` with `Authorization: Bearer rd_…`

```json
{ "url": "https://…", "text": "optional shared text (a link inside is used if url is missing)",
  "title": "optional", "note": "optional", "quote": "optional",
  "tags": ["Supply chain"] or "Supply chain, Data",
  "publish": true | false | "Publish now" | "Keep private" }
```

The response has `ok`, `created`, `id`, `title`, `source`, `status` and a
ready-made `message`. With `?format=text`, or `Accept: text/plain`, the
reply is just that message line as plain text, which a notification can show. Invalid or revoked tokens get `401`. The endpoint is rate
limited to 30 requests a minute per address.

## The Reading workspace

Admin → **Reading** is one page with four tabs, in the order the work happens. The settings sit behind the gear.

| Tab | What it's for |
| --- | --- |
| **Discover** (`/admin/reading`) | New articles from your sources, best match first (see Discover below). |
| **Inbox** (`/admin/reading/inbox`) | Articles you saved to read. Paste a link here, add a note, publish. An article saved more than a week ago can be added back to **this week**. |
| **This week** (`/admin/reading/week`) | The list as it builds up. Each pick says who added it (**Agent** or **You**) and why. When the Monday draft is ready, you approve it right here: untick picks, edit the intro and lines, ask for changes, or skip the week. **Draft the list now** runs the draft early. Removing a pick can be undone. |
| **Published** (`/admin/reading/published`) | Public articles, the weekly lists, and the archive. |
| **Settings** (`/admin/reading/settings`) | Sources, what to look for, the schedule, and ways to save. |

The tabs show counts, and a dot on **This week** when a list is waiting for you; Home links straight there. The old addresses (`/admin/feed`, `/admin/stories/weekly`, `/admin/certifications`) redirect to the right tab. In ⌘K, "shortlist", "sources" and similar words jump to the right tab.

## Weekly list (the agent finds articles for you)

Reading → settings (gear) is where you tell the agent what to look for:

- **Topics:** it starts with Investments, Finance, Engineering, Technology and Leadership.
- **Sites to favour** and **sites to never suggest** (optional). Without them it searches the whole web, through the same search service as Research.
- **How to judge an article:** the rubric it scores with (relevance counts double, then depth, credibility and recency).
- **Picks per week:** 3–7 by default.

**Sources** come first. The agent reads the feeds (RSS or Atom) of the publications and newsletters listed under Sources, so it needs no search credits and starts from sites you trust. A starting list is added once, grouped by your topics (Abnormal Returns, Of Dollars and Data, A Wealth of Common Sense, Marginal Revolution, The Pragmatic Engineer, Martin Fowler, Stratechery, Benedict Evans, Simon Willison, First Round Review, LeadDev); remove any you don't want and they won't come back. To add one, paste the site's address: its feed is found automatically, and the list says if a site has none. **Check all now** reads every feed straight away.

New articles from the feeds (the last 10 days, each considered once) are ranked by how close their words are to what you've saved, published and picked for a list, and how far from what you removed from the shortlist, so the ranking gets more "you" every week. The agent reads the best few closely, scores them with your rubric, and searches the web only for a topic the sources didn't cover (at most two searches a night).

**Discover** (Reading's first tab) shows every new article from your sources with its real link, best match first. Articles that match your taste strongly, or that the nightly agent shortlisted, are highlighted as **Recommended** and say why: the agent's reason, or "Because you saved …" naming the kept article it is most like. Each article has two main buttons, **Add to this week** and **Read later** (to your inbox), and **⋯** for **Publish now** and **Hide**. Hidden articles count against similar ones in the ranking, and Undo brings one back. Filter by topic, by source (the **All sources** menu, or click a source's name on an article; the choice stays in the page address), or show only recommended ones; **Check sources now** reads every feed straight away.

On a computer: **J**/**K** move, **S** adds to this week, **R** read later, **H** hides, **O** opens. On a phone: swipe right to add to this week, left to hide.

Two automatic jobs use these settings. Both start switched off; turn them on in the **Schedule** section of Reading settings (or on Automations).

1. **Find articles on my topics (nightly).** It searches two or three topics, reads the promising pieces, scores them and keeps a private shortlist of at most 15. Nothing is published. Each article is suggested only once, and never if it's already on your reading list. Remove anything from the shortlist and it won't come back.
2. **Prepare the weekly reading list (Mondays).** It picks from the shortlist and from what you saved yourself that week, writes a line on each and a short intro, and has the draft reviewed before showing it to you. **This week** then shows it, ready to approve. You can untick picks, edit the intro or any line, ask for changes ("make the intro two sentences"), approve, or skip the week.

When you approve, the list is published at `/reading/weekly/<week>` and its articles join your reading list. The Reading page links to the latest list. Approving twice publishes once.

Cost: the nightly search is capped at $0.50 a day and the weekly list at $1.50, inside the Studio's monthly cap. A typical night costs a few cents.

## For readers: email, RSS and share cards

**Weekly email.** Readers can sign up on `/reading/weekly` and on each week's page.
- **Double opt-in.** They get a confirmation link first. The form gives the same answer whether or not an address is already subscribed, and a hidden field catches bots.
- **Limits.** Sign-ups are limited to 5 an hour per address, and a confirmation is re-sent at most every 10 minutes.
- **Sending.** When you approve a weekly list, it is emailed to confirmed readers. Turn this off under Reading settings → Email subscribers.
- **Sent once.** A list goes out once: the list is claimed before sending, so a double approval or a retry never sends twice. If sending fails, the approval still publishes the list, and **Email to subscribers** on Reading → Published → Weekly lists sends it later.
- **Unsubscribing.** Every email has an unsubscribe link and the one-click `List-Unsubscribe` headers that mail apps use. Opening the link asks first, because mail scanners open links. Reading settings lists subscribers, and you can remove one along with their address.

**Setup (Resend).**
1. Create an account at resend.com and verify your domain (add the DNS records it shows).
2. Create an API key.
3. In Vercel, set `RESEND_API_KEY` and `EMAIL_FROM` (for example `Naren <weekly@narenc.com>`), then redeploy.

Without these, the sign-up form stays hidden. Links in emails and feeds use `SITE_URL` (default `https://narenc.com`).

**RSS.**
- **Feeds:** `/thoughts/rss.xml` has posts with their full text. `/reading/weekly/rss.xml` has each weekly list with its picks and lines.
- **Discovery:** every page advertises both feeds, so feed readers find them from the site's address.

**Share cards.** Each post and weekly list has a 1200×630 image (`…/opengraph-image`) with its title and the first picks. LinkedIn, X and messaging apps show it when the link is shared.

## Safety

- Pages are fetched only over http(s). The DNS answer is checked inside the
  connection's own lookup, so loopback, private, link-local, CGNAT and metadata
  addresses are refused even through redirects (at most 3) or DNS tricks.
  Responses are capped at 1.5 MB and 8 seconds.
- `READING_ALLOW_PRIVATE_HOSTS=1` lifts this for end-to-end tests only. Never
  set it in a deployment.
- Inbox and archived items are never sent to the public chatbot's knowledge
  base. Only published items are.
- Note suggestions use the Studio's AI settings and monthly budget. They appear
  as "Reading note" on the Activity page.
