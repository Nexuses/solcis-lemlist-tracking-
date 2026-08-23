import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  defaultDetailFieldsForChannel,
  DETAIL_FIELD_CATALOG,
  resolveDetailFields,
  type DetailFieldKey,
} from "@/lib/detail-fields";
import { ensureIndexes, getAutomationsCollection } from "@/lib/mongodb";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
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

    return NextResponse.json({
      detailFields: resolveDetailFields(
        automation.detailFields,
        automation.channelType ?? "email"
      ),
      catalog: DETAIL_FIELD_CATALOG,
      defaults: defaultDetailFieldsForChannel(automation.channelType ?? "email"),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load detail fields";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid automation id" }, { status: 400 });
    }

    const body = await request.json();
    const incoming = body.detailFields as DetailFieldKey[] | undefined;

    if (!incoming?.length) {
      return NextResponse.json(
        { error: "Select at least one detail field" },
        { status: 400 }
      );
    }

    const detailFields = resolveDetailFields(incoming);

    await ensureIndexes();
    const automations = await getAutomationsCollection();
    const result = await automations.updateOne(
      { _id: new ObjectId(id) },
      { $set: { detailFields } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    return NextResponse.json({ detailFields });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save detail fields";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
