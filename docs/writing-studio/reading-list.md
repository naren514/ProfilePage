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

1. In **Admin → Reading → Ways to save**, create a token and copy it. It is
   shown once; only its SHA-256 hash is stored. Revoke it there at any time.
2. In Shortcuts, create **Save to Reading**. Turn on **Show in Share Sheet**
   and accept URLs and Safari web pages.
3. Add **List** (`Keep private`, `Publish now`), then **Choose from List**.
4. Add **Ask for Input** (Text): "Your note (optional)".
5. Add **Get Contents of URL**:
   - URL: `https://<your site>/api/reading/save`
   - Method `POST`, header `Authorization: Bearer <token>`
   - JSON body: `url` = Shortcut Input, `publish` = Chosen Item,
     `note` = Provided Input
6. Add **Get Dictionary Value** (`message`) and **Show Notification**.

### API

`POST /api/reading/save` with `Authorization: Bearer rd_…`

```json
{ "url": "https://…", "text": "optional shared text (a link inside is used if url is missing)",
  "title": "optional", "note": "optional", "quote": "optional",
  "publish": true | false | "Publish now" | "Keep private" }
```

The response has `ok`, `created`, `id`, `title`, `source`, `status` and a
ready-made `message`. Invalid or revoked tokens get `401`. The endpoint is rate
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
