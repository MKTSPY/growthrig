# GrowthRig Voice Operations

## Current deployment mode

The Voice tab is safe by default. It generates browser-local preview briefs but cannot call anyone until every durable-call gate below is configured.

## Prerequisites

1. A Supabase project with Postgres access.
2. The migration at `supabase/migrations/001_voice_core.sql` applied in the Supabase SQL editor or via the Supabase CLI.
3. A generic ElevenLabs Conversational AI agent created using the context-grounded GrowthRig prompt.
4. A Twilio phone number imported into ElevenLabs.
5. An authenticated internal operator strategy. The current `x-growthrig-operator-id` header is a temporary demo placeholder; replace it with Supabase Auth, Clerk, or equivalent before broad operator access.

## Vercel Production environment variables

Set these in **Vercel → GrowthRig → Settings → Environment Variables → Production**:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
VOICE_PII_ENCRYPTION_KEY=...          # 32-byte base64 encryption key
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=...
ELEVENLABS_PHONE_NUMBER_ID=...        # ElevenLabs imported phone number ID, not raw number
VOICE_OUTBOUND_ENABLED=true
VOICE_PERSISTENCE=true
VOICE_DAILY_CALL_LIMIT=5
VOICE_CONFIRMATION_TTL_SECONDS=300
VOICE_ALLOWED_COUNTRIES=US
```

Keep `VOICE_AGENT_PROVISIONING_ENABLED=false` after the agent is created. Keep `VOICE_WEBHOOK_ENABLED=false` until the provider webhook signature contract has been validated.

## One controlled test call

1. Use a phone number that you own and can receive.
2. Create a contact with recorded consent evidence.
3. Create a durable preparation with a real thread/reply context.
4. Review the exact opening line, facts, and prohibited claims.
5. Enter a valid temporary operator ID.
6. Type `CALL <contact name>` exactly.
7. Confirm the call is queued and a provider call ID is present.
8. Verify the durable database row contains a call attempt but no plaintext phone number.
9. Review the resulting transcript/outcome before any broader rollout.

## Rollback / incident response

Immediately set this Vercel value and redeploy:

```text
VOICE_OUTBOUND_ENABLED=false
```

Then revoke the ElevenLabs API key or agent access if required, audit `call_attempts`, and rotate `VOICE_PII_ENCRYPTION_KEY` if compromise is suspected.

## Consent and privacy

Only call contacts with explicit, documented consent. Store consent source/evidence/timestamp server-side. Do not treat a browser checkbox alone as durable consent. Phone numbers are encrypted at rest when `VOICE_PII_ENCRYPTION_KEY` is configured. Browser preview data is not a CRM or cross-device source of truth.
