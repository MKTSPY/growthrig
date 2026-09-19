// POST /api/voice/call — DEPRECATED (HTTP 410)
// The old stateless browser-trusted call endpoint has been replaced by the
// durable preparation flow. No provider call is ever made from this route.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BODY = {
  error: "Deprecated",
  status: "deprecated",
  message:
    "This endpoint no longer accepts call requests. " +
    "Use the durable preparation flow: " +
    "POST /api/voice/preparations → confirm → " +
    "POST /api/voice/preparations/{id}/call",
};

export async function POST() {
  return NextResponse.json(BODY, { status: 410 });
}

export async function GET() {
  return NextResponse.json(BODY, { status: 410 });
}
