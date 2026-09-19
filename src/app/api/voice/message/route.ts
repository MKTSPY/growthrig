// POST /api/voice/message — validated echo only, stateless.
//
// On Vercel serverless the global store is not shared across function
// instances. This route validates message fields and echoes back a
// normalised message. The browser owns the canonical history in localStorage.
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const VALID_ROLES = ["agent", "contact", "system"] as const;
const VALID_CHANNELS = ["reddit", "phone", "web"] as const;

type MessageRole = (typeof VALID_ROLES)[number];
type MessageChannel = (typeof VALID_CHANNELS)[number];

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const contact_id = typeof b.contact_id === "string" ? b.contact_id.trim() : "";
  if (!contact_id) {
    return NextResponse.json({ error: "contact_id is required." }, { status: 400 });
  }

  const role = b.role as MessageRole;
  if (!(VALID_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json(
      { error: `role must be one of: ${VALID_ROLES.join(", ")}.` },
      { status: 400 },
    );
  }

  const channel = b.channel as MessageChannel;
  if (!(VALID_CHANNELS as readonly string[]).includes(channel)) {
    return NextResponse.json(
      { error: `channel must be one of: ${VALID_CHANNELS.join(", ")}.` },
      { status: 400 },
    );
  }

  const content = typeof b.content === "string" ? b.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "content must not be blank." }, { status: 400 });
  }

  const thread_id = typeof b.thread_id === "string" && b.thread_id.trim()
    ? b.thread_id.trim()
    : undefined;

  const message = {
    id: `m_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    contact_id,
    thread_id,
    role,
    content,
    channel,
    at: new Date().toISOString(),
  };

  return NextResponse.json({
    message,
    note: "Validation only — not persisted server-side. Store in the browser.",
  });
}
