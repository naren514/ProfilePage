import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Chat is disabled for this deployment." },
    { status: 501 }
  );
}
