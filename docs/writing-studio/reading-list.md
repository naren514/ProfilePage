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

## One-time setup

Open Admin → Reading and choose **Set up now**. This runs the same idempotent
setup as the Writing Studio (`POST /api/admin/writing/setup`), adding to the
existing `certifications` table:

- `status` (`inbox`, `published` or `archived`; `is_active` mirrors `published`)
- `note`, `suggested_note`, `quote`, `image_url`, `site_name`, `author`,
  `saved_via`, `url_normalized` (unique) and `saved_at`

It also creates the `api_tokens` table. Existing entries stay published, and
their old excerpt becomes the note. Until setup has run, the public page keeps
working from the original columns.

## iPhone Shortcut

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

3. Create a token in **Admin → Reading → Ways to save** and copy it. Use
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
  "publish": true | false | "Publish now" | "Keep private" }
```

The response has `ok`, `created`, `id`, `title`, `source`, `status` and a
ready-made `message`. With `?format=text`, or `Accept: text/plain`, the
reply is just that message line as plain text, which a notification can show. Invalid or revoked tokens get `401`. The endpoint is rate
limited to 30 requests a minute per address.

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
