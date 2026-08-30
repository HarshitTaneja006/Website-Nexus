import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Standard RFC 5322 compatible email regex
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function sanitizeText(input: unknown, maxLength: number): string {
  if (typeof input !== "string") return "";
  return input.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, maxLength);
}

export async function POST(req: NextRequest) {
  try {
    let body: {
      name?: unknown;
      email?: unknown;
      branch?: unknown;
      year?: unknown;
      interest?: unknown;
      message?: unknown;
    };

    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: "Malformed JSON payload" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const name = sanitizeText(body?.name, 80);
    const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const branch = sanitizeText(body?.branch, 100);
    const year = sanitizeText(body?.year, 20);
    const interest = sanitizeText(body?.interest, 100);
    const rawMessage = sanitizeText(body?.message, 500);
    const message = rawMessage.length > 0 ? rawMessage : null;

    if (!name || name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: "Name must be between 2 and 80 characters" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    if (!rawEmail || rawEmail.length > 254 || !EMAIL_RE.test(rawEmail)) {
      return NextResponse.json(
        { error: "A valid email address is required (max 254 characters)" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    if (!branch || branch.length < 2) {
      return NextResponse.json(
        { error: "Branch is required (max 100 characters)" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    if (!year) {
      return NextResponse.json(
        { error: "Year is required (max 20 characters)" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    if (!interest || interest.length < 2) {
      return NextResponse.json(
        { error: "Interest area is required (max 100 characters)" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Check if an identical pending request already exists to mitigate duplicate spam
    const existingPending = await db.joinRequest.findFirst({
      where: { email: rawEmail, status: "pending" },
    });

    if (existingPending) {
      return NextResponse.json(
        {
          ok: true,
          id: existingPending.id,
          alreadyPending: true,
          message: "Application is already pending review",
        },
        { headers: { "cache-control": "no-store" } }
      );
    }

    const jr = await db.joinRequest.create({
      data: {
        name,
        email: rawEmail,
        branch,
        year,
        interest,
        message,
      },
    });

    return NextResponse.json(
      { ok: true, id: jr.id },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error("POST /api/join failed:", err);
    return NextResponse.json(
      { error: "Failed to submit join request" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
