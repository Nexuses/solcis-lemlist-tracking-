import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureIndexes, getAutomationsCollection } from "@/lib/mongodb";
import { syncAutomation } from "@/lib/sync";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid automation id" }, { status: 400 });
    }

    await ensureIndexes();
    const automations = await getAutomationsCollection();
    const automation = await automations.findOne({ _id: new ObjectId(id) });

    if (!automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

    const result = await syncAutomation(id, {
      registerWebhook: true,
      appUrl,
    });

    return NextResponse.json({
      prospectCount: result.prospectCount,
      lastSyncedAt: new Date(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync automation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
