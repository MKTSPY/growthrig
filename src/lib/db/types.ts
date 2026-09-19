export type ConsentStatus = 'pending' | 'granted' | 'revoked';

export type Contact = {
  id: string;
  workspace_id?: string | null;
  display_name: string;
  phone_number_encrypted?: string | null;
  reddit_handle?: string | null;
  timezone?: string | null;
  consent_status: ConsentStatus;
  consent_source?: string | null;
  consent_evidence?: string | null;
  consent_captured_at?: string | null; // ISO
  consent_captured_by?: string | null;
  consent_revoked_at?: string | null; // ISO
  consent_revoked_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type ThreadContext = {
  id: string;
  source?: string | null;
  thread_url?: string | null;
  title?: string | null;
  body_excerpt?: string | null;
  sent_reply?: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationMessage = {
  id: string;
  contact_id?: string | null;
  thread_context_id?: string | null;
  role: 'agent' | 'contact' | 'system';
  channel: 'reddit' | 'phone' | 'web';
  content: string;
  source_url?: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

export type VoicePreparation = {
  id: string;
  contact_id?: string | null;
  thread_context_id?: string | null;
  elevenlabs_agent_id?: string | null;
  purpose?: string | null;
  context_snapshot?: object | null;
  prompt_version?: string | null;
  status: 'draft' | 'ready' | 'confirmed' | 'queued' | 'complete' | 'failed' | 'disabled';
  confirmation_nonce_hash?: string | null;
  confirmation_expires_at?: string | null;
  confirmation_consumed_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type CallAttempt = {
  id: string;
  preparation_id?: string | null;
  idempotency_key: string;
  provider_call_id?: string | null;
  provider_status?: string | null;
  request_snapshot?: object | null;
  sanitized_response?: object | null;
  initiated_by?: string | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
};

export type VoiceEvent = {
  id: string;
  call_attempt_id?: string | null;
  provider_event_id?: string | null;
  event_type: string;
  payload?: object | null;
  received_at: string;
  created_at: string;
  updated_at: string;
};
