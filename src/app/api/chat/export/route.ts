import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Chat export is unavailable because chat is disabled." },
    { status: 501 }
  );
}
