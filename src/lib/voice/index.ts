// GrowthRig — voice adapter public surface
//
// Import from this module, not from the individual files, so internal
// implementation details can move without breaking call sites.

export type {
  VoiceChannel,
  VoiceContact,
  VoiceContext,
  VoiceCallRequest,
  VoiceCallResult,
  VoiceAgentStatus,
} from "./types";

export {
  getVoiceAgentStatus,
  buildSystemPrompt,
  prepareVoiceBrief,
  startConfirmedCall,
  createGrowthRigAgent,
  buildCreateAgentBody,
} from "./elevenlabs";

export type { CreateAgentResult } from "./elevenlabs";
