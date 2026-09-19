// POST /api/voice/message — DEPRECATED (HTTP 410)
// Message persistence is now handled server-side via the durable preparation
// flow. No data is read or written here.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BODY = {
  error: "Deprecated",
  status: "deprecated",
  message:
    "This endpoint no longer persists messages. " +
    "Messages are attached to contacts via the durable preparation flow at POST /api/voice/preparations.",
};

export async function POST() {
  return NextResponse.json(BODY, { status: 410 });
}

export async function GET() {
  return NextResponse.json(BODY, { status: 410 });
}
