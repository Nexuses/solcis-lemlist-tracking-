import { NextResponse } from "next/server";
import { getCampaigns } from "@/lib/lemlist";

export async function GET() {
  try {
    const campaigns = await getCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch campaigns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
