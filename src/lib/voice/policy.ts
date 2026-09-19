// GrowthRig — Voice call policy
//
// All gates default to FAIL CLOSED. Nothing here makes network calls.
// Env vars are read at call-time, never cached at module load.

export interface VoicePolicy {
  outboundEnabled: boolean;
  operatorAuthRequired: boolean;
  persistenceRequired: boolean;
  dailyCallLimit: number;
  confirmationTtlSeconds: number;
  /** Upper-case ISO 3166-1 alpha-2 codes, e.g. ["US"] */
  allowedCountries: string[];
  businessHoursLocal: { startHour: number; endHour: number };
}

export function getVoicePolicy(): VoicePolicy {
  return {
    outboundEnabled: process.env.VOICE_OUTBOUND_ENABLED === "true",
    operatorAuthRequired: true, // always required; no env override
    persistenceRequired: process.env.VOICE_PERSISTENCE !== "false",
    dailyCallLimit: parseInt(process.env.VOICE_DAILY_CALL_LIMIT ?? "5", 10),
    confirmationTtlSeconds: parseInt(
      process.env.VOICE_CONFIRMATION_TTL_SECONDS ?? "300",
      10,
    ),
    allowedCountries: (process.env.VOICE_ALLOWED_COUNTRIES ?? "US")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
    // Business hours applied in UTC (operator chooses UTC for simplicity;
    // timezone-aware enforcement requires the contact's IANA tz).
    businessHoursLocal: { startHour: 9, endHour: 18 },
  };
}

// ---------------------------------------------------------------------------
// evaluateCallPolicy
// ---------------------------------------------------------------------------

/**
 * Returns { ok, reasons } for a prospective outbound call.
 * Any failed gate adds a human-readable string to reasons[].
 * ok === (reasons.length === 0).
 *
 * E.164 country heuristic:
 *   +1  → "1"  (US/CA — treated as "US" for the default allowedCountries)
 *   +44 → "44" (GB)
 *   etc.
 * We match the *digits* from VOICE_ALLOWED_COUNTRIES against the leading
 * digits of the phone number (after the "+").  A country code of "US" maps
 *   to "1"; if operators want to allow Canada they should add "CA" only if
 *   they explicitly add the numeric code "1" to VOICE_ALLOWED_COUNTRIES, OR
 *   we map ISO-2 → dial-code for the common cases below.
 *
 * Supported ISO→dial mapping (extend as needed):
 *   US → 1, CA → 1, GB → 44, AU → 61, DE → 49, FR → 33, IN → 91
 */
const ISO_TO_DIAL: Record<string, string> = {
  US: "1",
  CA: "1",
  GB: "44",
  AU: "61",
  DE: "49",
  FR: "33",
  IN: "91",
};

function allowedDialCodes(countries: string[]): string[] {
  const codes: string[] = [];
  for (const c of countries) {
    const dial = ISO_TO_DIAL[c];
    if (dial && !codes.includes(dial)) codes.push(dial);
    // If operator put a numeric code directly (e.g. "44") also accept it.
    if (/^\d+$/.test(c) && !codes.includes(c)) codes.push(c);
  }
  return codes;
}

export function evaluateCallPolicy(args: {
  contact: { phone_number?: string; timezone?: string };
  nowUtc: Date;
}): { ok: boolean; reasons: string[] } {
  const policy = getVoicePolicy();
  const reasons: string[] = [];

  if (!policy.outboundEnabled) {
    reasons.push(
      "VOICE_OUTBOUND_ENABLED is not set to 'true' — outbound calls are disabled by default",
    );
  }

  const phone = args.contact.phone_number ?? "";
  const e164Re = /^\+[1-9]\d{6,14}$/;
  if (!e164Re.test(phone)) {
    reasons.push("phone_number is not a valid E.164 number (e.g. +14155551234)");
  } else {
    const digits = phone.slice(1); // strip leading "+"
    const dialCodes = allowedDialCodes(policy.allowedCountries);
    const matched = dialCodes.some((code) => digits.startsWith(code));
    if (!matched) {
      reasons.push(
        `phone country not in allowed list (${policy.allowedCountries.join(", ")})`
      );
    }
  }

  // Business-hours check against UTC hour (see note above)
  const utcHour = args.nowUtc.getUTCHours();
  const { startHour, endHour } = policy.businessHoursLocal;
  if (utcHour < startHour || utcHour >= endHour) {
    reasons.push(
      `outside business hours (${startHour}:00–${endHour}:00 UTC; ` +
        `current UTC hour: ${utcHour})`,
    );
  }

  return { ok: reasons.length === 0, reasons };
}
