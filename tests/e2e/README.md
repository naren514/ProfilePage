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

Recreate the database before each run; the script expects the seeded state.
`DATABASE_DRIVER=pg` is for local runs only. Production uses Neon over HTTP.
