import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  ensureIndexes,
  getAutomationsCollection,
} from "@/lib/mongodb";
import {
  defaultColumnsForChannel,
  type AutomationChannel,
} from "@/lib/kanban-config";
import { defaultDetailFieldsForChannel } from "@/lib/detail-fields";
import { syncAutomation } from "@/lib/sync";
import type { Automation } from "@/lib/types";

export async function GET() {
  try {
    await ensureIndexes();
    const automations = await getAutomationsCollection();
    const list = await automations
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      automations: list.map((a) => ({
        ...a,
        _id: String(a._id),
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list automations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureIndexes();
    const body = await request.json();
    const { name, campaignId, campaignName, channelType } = body as {
      name?: string;
      campaignId?: string;
      campaignName?: string;
      channelType?: AutomationChannel;
    };

    if (!name?.trim() || !campaignId?.trim()) {
      return NextResponse.json(
        { error: "Name and campaign are required" },
        { status: 400 }
      );
    }

    const channel: AutomationChannel =
      channelType === "linkedin" ? "linkedin" : "email";

    const automations = await getAutomationsCollection();
    const slug = nanoid(10);

    const automation: Automation = {
      name: name.trim(),
      slug,
      campaignId: campaignId.trim(),
      campaignName: campaignName?.trim() ?? campaignId,
      channelType: channel,
      kanbanColumns: defaultColumnsForChannel(channel),
      detailFields: defaultDetailFieldsForChannel(channel),
      createdAt: new Date(),
    };

    const result = await automations.insertOne(automation);
    const automationId = String(result.insertedId);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      request.nextUrl.origin;

    const syncResult = await syncAutomation(automationId, {
      registerWebhook: true,
      appUrl,
    });

    return NextResponse.json({
      automation: {
        ...automation,
        _id: automationId,
        lastSyncedAt: new Date(),
        prospectCount: syncResult.prospectCount,
      },
      publicUrl: `${appUrl}/board/${slug}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create automation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
