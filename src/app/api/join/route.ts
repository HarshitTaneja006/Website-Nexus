import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const branch = typeof body?.branch === "string" ? body.branch.trim() : "";
    const year = typeof body?.year === "string" ? body.year.trim() : "";
    const interest = typeof body?.interest === "string" ? body.interest.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim().slice(0, 500) : "";

    if (!name || name.length > 80) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "email does not parse" }, { status: 400 });
    }
    if (!branch || !year || !interest) {
      return NextResponse.json(
        { error: "branch, year and interest are required" },
        { status: 400 }
      );
    }

    const jr = await db.joinRequest.create({
      data: { name, email, branch, year, interest, message: message || null },
    });

    return NextResponse.json({ ok: true, id: jr.id });
  } catch (err) {
    console.error("POST /api/join failed:", err);
    return NextResponse.json({ error: "join fault" }, { status: 500 });
  }
}
