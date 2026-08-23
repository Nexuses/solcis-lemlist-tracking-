import { NextResponse } from "next/server";
import {
  ensureIndexes,
  getAutomationsCollection,
  getProspectsCollection,
} from "@/lib/mongodb";
import {
  assignProspectColumnId,
  resolveKanbanColumns,
} from "@/lib/kanban-config";
import { resolveDetailFields } from "@/lib/detail-fields";
import { serializeProspectForBoard } from "@/lib/prospect-fields";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    await ensureIndexes();

    const automations = await getAutomationsCollection();
    const prospectsCol = await getProspectsCollection();

    const automation = await automations.findOne({ slug });
    if (!automation) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const columnsConfig = resolveKanbanColumns(
      automation.kanbanColumns,
      automation.channelType ?? "email"
    );

    const prospects = await prospectsCol
      .find({ automationId: String(automation._id) })
      .sort({ updatedAt: -1 })
      .toArray();

    const columns = columnsConfig.map((column) => ({
      id: column.id,
      title: column.title,
      description: column.description,
      rule: column.rule,
      color: column.color,
      colorBg: column.colorBg,
      prospects: prospects
        .filter(
          (p) => assignProspectColumnId(p, columnsConfig) === column.id
        )
        .map((p) => serializeProspectForBoard(p)),
    }));

    return NextResponse.json({
      automation: {
        name: automation.name,
        campaignName: automation.campaignName,
        slug: automation.slug,
        channelType: automation.channelType ?? "email",
        lastSyncedAt: automation.lastSyncedAt,
        prospectCount: automation.prospectCount ?? prospects.length,
      },
      detailFields: resolveDetailFields(
        automation.detailFields,
        automation.channelType ?? "email"
      ),
      columns,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load board";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
