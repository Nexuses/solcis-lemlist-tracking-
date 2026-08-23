import { NextRequest, NextResponse } from "next/server";
import {
  ensureIndexes,
  getAutomationsCollection,
  getProspectsCollection,
} from "@/lib/mongodb";
import { resolveKanbanColumns } from "@/lib/kanban-config";

type RouteContext = { params: Promise<{ slug: string; leadId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { slug, leadId } = await context.params;
    const body = await request.json();
    const columnId = body.columnId as string | null | undefined;

    if (columnId !== null && columnId !== undefined && !String(columnId).trim()) {
      return NextResponse.json({ error: "Invalid columnId" }, { status: 400 });
    }

    await ensureIndexes();
    const automations = await getAutomationsCollection();
    const prospectsCol = await getProspectsCollection();

    const automation = await automations.findOne({ slug });
    if (!automation) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const columns = resolveKanbanColumns(automation.kanbanColumns, automation.channelType ?? "email");
    if (columnId && !columns.some((col) => col.id === columnId)) {
      return NextResponse.json({ error: "Column not found" }, { status: 400 });
    }

    const update =
      columnId === null
        ? {
            $unset: { assignedColumnId: "" as const },
            $set: { updatedAt: new Date() },
          }
        : {
            $set: {
              assignedColumnId: columnId,
              updatedAt: new Date(),
            },
          };

    const result = await prospectsCol.updateOne(
      {
        automationId: String(automation._id),
        leadId,
      },
      update
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, columnId: columnId ?? null });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to move prospect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, leadId } = await context.params;

    await ensureIndexes();
    const automations = await getAutomationsCollection();
    const prospectsCol = await getProspectsCollection();

    const automation = await automations.findOne({ slug });
    if (!automation) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const result = await prospectsCol.deleteOne({
      automationId: String(automation._id),
      leadId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    await automations.updateOne(
      { _id: automation._id },
      { $inc: { prospectCount: -1 } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete prospect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
