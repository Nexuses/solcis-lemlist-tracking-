import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { nanoid } from "nanoid";
import {
  ALL_ENGAGEMENT_STAGES,
  createKanbanColumn,
  defaultColumnsForChannel,
  resolveKanbanColumns,
  type AutomationKanbanColumn,
  type KanbanColumnRule,
} from "@/lib/kanban-config";
import { ensureIndexes, getAutomationsCollection } from "@/lib/mongodb";
import type { EngagementStage } from "@/lib/types";

type RouteContext = { params: Promise<{ id: string }> };

function parseRule(body: {
  ruleType?: string;
  stages?: EngagementStage[];
}): KanbanColumnRule | null {
  if (body.ruleType === "hot") {
    return { type: "hot" };
  }
  if (body.ruleType === "manual") {
    return { type: "manual" };
  }
  if (body.ruleType === "stages" && body.stages?.length) {
    const valid = body.stages.filter((s) =>
      ALL_ENGAGEMENT_STAGES.some((x) => x.value === s)
    );
    if (valid.length) return { type: "stages", stages: valid };
  }
  return null;
}

function normalizeColumns(
  columns: AutomationKanbanColumn[]
): AutomationKanbanColumn[] {
  return columns
    .map((col, index) => ({
      id: col.id?.trim() || nanoid(8),
      title: col.title?.trim() || "Column",
      description: col.description?.trim() ?? "",
      rule: col.rule,
      order: typeof col.order === "number" ? col.order : index,
      color: col.color,
      colorBg: col.colorBg,
    }))
    .sort((a, b) => a.order - b.order)
    .map((col, index) => ({ ...col, order: index }));
}

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
      columns: resolveKanbanColumns(automation.kanbanColumns, automation.channelType ?? "email"),
      stageOptions: ALL_ENGAGEMENT_STAGES,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load columns";
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
    const incoming = body.columns as AutomationKanbanColumn[] | undefined;

    if (!incoming?.length) {
      return NextResponse.json(
        { error: "At least one column is required" },
        { status: 400 }
      );
    }

    const columns = normalizeColumns(incoming);

    await ensureIndexes();
    const automations = await getAutomationsCollection();
    const result = await automations.updateOne(
      { _id: new ObjectId(id) },
      { $set: { kanbanColumns: columns } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    return NextResponse.json({ columns });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save columns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid automation id" }, { status: 400 });
    }

    const body = await request.json();
    const title = body.title as string | undefined;
    const description = (body.description as string | undefined) ?? "";
    const rule = parseRule(body);

    if (!title?.trim()) {
      return NextResponse.json({ error: "Column title is required" }, { status: 400 });
    }
    if (!rule) {
      return NextResponse.json(
        { error: "Valid rule (hot, manual, or stages) is required" },
        { status: 400 }
      );
    }

    await ensureIndexes();
    const automations = await getAutomationsCollection();
    const automation = await automations.findOne({ _id: new ObjectId(id) });

    if (!automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    const existing = resolveKanbanColumns(automation.kanbanColumns, automation.channelType ?? "email");
    const newColumn = createKanbanColumn(
      title,
      rule,
      description,
      existing.length
    );
    const columns = normalizeColumns([...existing, newColumn]);

    await automations.updateOne(
      { _id: automation._id },
      { $set: { kanbanColumns: columns } }
    );

    return NextResponse.json({ column: newColumn, columns });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add column";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid automation id" }, { status: 400 });
    }

    const columnId = request.nextUrl.searchParams.get("columnId");
    if (!columnId) {
      return NextResponse.json({ error: "columnId is required" }, { status: 400 });
    }

    await ensureIndexes();
    const automations = await getAutomationsCollection();
    const automation = await automations.findOne({ _id: new ObjectId(id) });

    if (!automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    const existing = resolveKanbanColumns(automation.kanbanColumns, automation.channelType ?? "email");
    if (existing.length <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last column" },
        { status: 400 }
      );
    }

    const columns = normalizeColumns(
      existing.filter((col) => col.id !== columnId)
    );

    await automations.updateOne(
      { _id: automation._id },
      { $set: { kanbanColumns: columns } }
    );

    return NextResponse.json({ columns });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete column";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid automation id" }, { status: 400 });
    }

    const body = await request.json();

    if (body.action === "reorder") {
      const columnIds = body.columnIds as string[] | undefined;
      if (!columnIds?.length) {
        return NextResponse.json(
          { error: "columnIds array is required" },
          { status: 400 }
        );
      }

      await ensureIndexes();
      const automations = await getAutomationsCollection();
      const automation = await automations.findOne({ _id: new ObjectId(id) });

      if (!automation) {
        return NextResponse.json({ error: "Automation not found" }, { status: 404 });
      }

      const existing = resolveKanbanColumns(automation.kanbanColumns, automation.channelType ?? "email");
      const byId = new Map(existing.map((col) => [col.id, col]));
      const reordered = columnIds
        .map((cid) => byId.get(cid))
        .filter((col): col is AutomationKanbanColumn => Boolean(col));

      if (reordered.length !== existing.length) {
        return NextResponse.json(
          { error: "columnIds must include every column exactly once" },
          { status: 400 }
        );
      }

      const columns = normalizeColumns(reordered);
      await automations.updateOne(
        { _id: automation._id },
        { $set: { kanbanColumns: columns } }
      );

      return NextResponse.json({ columns });
    }

    if (body.action === "reset") {
      await ensureIndexes();
      const automations = await getAutomationsCollection();
      const automation = await automations.findOne({ _id: new ObjectId(id) });
      if (!automation) {
        return NextResponse.json(
          { error: "Automation not found" },
          { status: 404 }
        );
      }
      const columns = defaultColumnsForChannel(
        automation.channelType ?? "email"
      );
      await automations.updateOne(
        { _id: new ObjectId(id) },
        { $set: { kanbanColumns: columns } }
      );
      return NextResponse.json({ columns });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update columns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
