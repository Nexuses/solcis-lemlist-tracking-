import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  ensureIndexes,
  getAutomationsCollection,
  getProspectsCollection,
} from "@/lib/mongodb";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid automation id" }, { status: 400 });
    }

    await ensureIndexes();
    const automations = await getAutomationsCollection();
    const prospects = await getProspectsCollection();

    const result = await automations.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    await prospects.deleteMany({ automationId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete automation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
