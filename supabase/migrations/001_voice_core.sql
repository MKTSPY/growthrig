-- Enable pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- contacts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NULL,
  display_name TEXT NOT NULL,
  phone_number_encrypted TEXT,
  reddit_handle TEXT,
  timezone TEXT,
  consent_status TEXT NOT NULL CHECK (consent_status IN ('pending','granted','revoked')) DEFAULT 'pending',
  consent_source TEXT,
  consent_evidence TEXT,
  consent_captured_at TIMESTAMPTZ,
  consent_captured_by TEXT,
  consent_revoked_at TIMESTAMPTZ,
  consent_revoked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- thread_contexts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thread_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT,
  thread_url TEXT,
  title TEXT,
  body_excerpt TEXT,
  sent_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- conversation_messages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  thread_context_id UUID REFERENCES thread_contexts(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('agent','contact','system')),
  channel TEXT NOT NULL CHECK (channel IN ('reddit','phone','web')),
  content TEXT NOT NULL,
  source_url TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- voice_preparations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_preparations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  thread_context_id UUID REFERENCES thread_contexts(id) ON DELETE SET NULL,
  elevenlabs_agent_id TEXT,
  purpose TEXT,
  context_snapshot JSONB,
  prompt_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','ready','confirmed','queued','complete','failed','disabled')) DEFAULT 'draft',
  confirmation_nonce_hash TEXT,
  confirmation_expires_at TIMESTAMPTZ,
  confirmation_consumed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- call_attempts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preparation_id UUID REFERENCES voice_preparations(id) ON DELETE CASCADE,
  workspace_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_call_id TEXT,
  provider_status TEXT,
  request_snapshot JSONB,
  sanitized_response JSONB,
  initiated_by TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- voice_events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_attempt_id UUID REFERENCES call_attempts(id) ON DELETE CASCADE,
  provider_event_id TEXT UNIQUE,
  event_type TEXT,
  payload JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_id ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_consent_status ON contacts(consent_status);
CREATE INDEX IF NOT EXISTS idx_thread_contexts_thread_url ON thread_contexts(thread_url);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_thread_context_id ON conversation_messages(thread_context_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_contact_id ON conversation_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_voice_preparations_contact_id ON voice_preparations(contact_id);
CREATE INDEX IF NOT EXISTS idx_voice_preparations_status ON voice_preparations(status);
CREATE INDEX IF NOT EXISTS idx_voice_preparations_elevenlabs_agent_id ON voice_preparations(elevenlabs_agent_id);
CREATE INDEX IF NOT EXISTS idx_call_attempts_preparation_id ON call_attempts(preparation_id);
CREATE INDEX IF NOT EXISTS idx_call_attempts_provider_call_id ON call_attempts(provider_call_id);
CREATE INDEX IF NOT EXISTS idx_call_attempts_provider_status ON call_attempts(provider_status);
CREATE INDEX IF NOT EXISTS idx_voice_events_provider_event_id ON voice_events(provider_event_id);

-- ------------------------------------------------------------
-- Updated_at trigger
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to all tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
  LOOP
    IF NOT EXISTS(
      SELECT 1 FROM pg_trigger WHERE tgrelid = t::regclass AND tgname = 'set_updated_at'
    ) THEN
      EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();', t);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- RLS Policies
-- ------------------------------------------------------------
-- Enable RLS on all tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- Default deny all
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS allow_authenticated_%I ON %I;', t, t);
    EXECUTE format('CREATE POLICY allow_authenticated_%I ON %I USING (auth.role() = ''authenticated'');', t, t);
  END LOOP;
END $$;

-- Ensure authenticated policy also allows INSERT/UPDATE/DELETE for workspace operators
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
  LOOP
    EXECUTE format('CREATE POLICY allow_authenticated_modify_%I ON %I FOR ALL USING (auth.role() = ''authenticated'');', t, t);
  END LOOP;
END $$;

-- Note: Service role key can bypass RLS; client code should use service role.
-- End of migration
