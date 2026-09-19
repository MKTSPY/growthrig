// GrowthRig — conversations module public API
//
// Import from here, not from store.ts or types.ts directly.

// Types
export type {
  BuildContextInput,
  ConversationContact,
  ConversationMessage,
  MessageChannel,
  MessageRole,
  PreparationStatus,
  VoiceContext,
  VoiceContextMessage,
  VoicePreparation,
} from "./types";

// Store functions
export type { AddMessageInput, CreatePreparationInput, PreparationPatch, SaveContactInput } from "./store";

export {
  addMessage,
  buildConversationContext,
  createPreparation,
  getPreparation,
  listContacts,
  listMessages,
  listPreparations,
  recordCallOutcome,
  saveContact,
  setContactConsent,
  updatePreparation,
} from "./store";
