# Supabase Setup for GrowthRig Voice Persistence

## Prerequisites

* **Supabase Project** – Create a free Supabase project at https://app.supabase.com.
* **Node 18+** – Required for the built‑in `fetch` used by the admin client.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | The public URL of your Supabase project, e.g. `https://xyzcompany.supabase.co`. | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service‑role API key. Must **not** be exposed to the browser. | ✅ |
| `VOICE_PII_ENCRYPTION_KEY` | 32‑byte hex string used for AES‑256‑GCM encryption of phone numbers. | ❌ – optional; if omitted phone persistence is disabled.
| `VOICE_DAILY_CALL_LIMIT` | Maximum number of call attempts per workspace per day. | ❌ – defaults to `5`.

> **Security Note**: The `SUPABASE_SERVICE_ROLE_KEY` should **never** be committed to source control or exposed to the client. Store it in a deployment environment (e.g., Vercel secrets) and reference it via `process.env`.

## Database Migration

Run the migration locally:

```bash
# From the project root
pnpm install -g supabase

# Create the migration directory if not already present
mkdir -p supabase/migrations

# Apply migration (replace <project-id> with your actual project id)
supabase db reset --yes   # optional: drop & recreate schema
supabase db push
```

Alternatively, you can execute the SQL directly from the Supabase Dashboard:

1. Go to **Database → SQL Editor**.
2. Paste the contents of `supabase/migrations/001_voice_core.sql`.
3. Click **Run**.

## Service‑Role Policy (Optional Extra Security)

By default the migration enables Row Level Security (RLS) and applies a permissive policy for rows where `auth.role() = 'authenticated'`. If you prefer tighter control, you can replace the generated policies with your own. For example, to restrict all operations to a specific workspace operator, add:

```sql
CREATE POLICY workspace_operator ON contacts USING (workspace_id = current_setting('app.current_workspace'));
```

and set the setting in your application context before any query.

## Using the Admin Client

The TypeScript helper `src/lib/db/client.ts` exposes a minimal `postgrest` client that talks to the PostgREST endpoint. It automatically attaches the service‑role key for authentication.

```ts
import { getSupabaseAdmin } from '@/lib/db/client';

const admin = getSupabaseAdmin();
if (!admin) throw new Error('Supabase not configured');

// Insert a row into contacts
const newContact = await admin.postgrest('contacts', {
  method: 'POST',
  body: {
    display_name: 'Alice',
  },
});
```

## Next Steps

* **Create operator credentials** – In Supabase, create a user with the `authenticated` role that represents your growth‑rig operator.
* **Add a webhook** – If you wish to receive provider events, implement `/api/voice/webhook` and store them via `appendVoiceEvent`.
* **Deploy** – Make sure the environment variables are set on your deployment platform.

---

For any questions, see the Supabase documentation: https://supabase.com/docs/guides
