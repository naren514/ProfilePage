-- Minimal schema + two legacy posts for the Writing Studio end-to-end run.
-- Run against an empty local database (see tests/e2e/README.md).
CREATE TABLE stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, slug varchar(255) NOT NULL UNIQUE, summary text NOT NULL,
  situation text, task text, action text, result text, lessons_learned text,
  company text, role text, date date, tags text[] DEFAULT '{}',
  is_featured boolean NOT NULL DEFAULT false, is_published boolean NOT NULL DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL UNIQUE, value jsonb NOT NULL,
  category text NOT NULL DEFAULT 'general', label text, description text,
  updated_at timestamp NOT NULL DEFAULT now(), updated_by text
);
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), filename text NOT NULL, original_name text NOT NULL,
  mime_type text NOT NULL, file_size integer NOT NULL, storage_path text NOT NULL,
  category text NOT NULL DEFAULT 'general', is_active boolean NOT NULL DEFAULT true, uploaded_by text,
  processed_at timestamp, chunk_count integer DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
INSERT INTO stories (title, slug, summary, action, situation, date, tags, is_published) VALUES
 ('Lessons from a migration', 'lessons-from-a-migration', 'What moving a legacy system taught me.',
  '<h2>Background</h2><p>We had <strong>ten years</strong> of data and <a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">one plan</a>.</p><ul><li><p>Plan</p></li><li><p>Execute</p></li></ul><img src="https://example.com/a.jpg" alt="Diagram">',
  'A legacy STAR context paragraph.', '2026-10-01', '{engineering,lessons}', true),
 ('Unfinished idea', 'unfinished-idea', 'A draft I never finished.', '<p>Secret draft text about something private.</p>', NULL, NULL, '{}', false);
