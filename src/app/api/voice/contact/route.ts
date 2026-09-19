// POST /api/voice/contact — DEPRECATED (HTTP 410)
// Contact persistence is now handled server-side via the durable preparation
// flow at POST /api/voice/preparations. No data is read or written here.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BODY = {
  error: "Deprecated",
  status: "deprecated",
  message:
    "This endpoint no longer persists contacts. " +
    "Use POST /api/voice/preparations which creates the contact durably as part of the preparation.",
};

export async function POST() {
  return NextResponse.json(BODY, { status: 410 });
}

export async function GET() {
  return NextResponse.json(BODY, { status: 410 });
}
