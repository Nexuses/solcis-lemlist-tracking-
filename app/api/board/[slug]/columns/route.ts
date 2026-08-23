import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  ALL_ENGAGEMENT_STAGES,
  createKanbanColumn,
  resolveKanbanColumns,
  type AutomationKanbanColumn,
  type KanbanColumnRule,
} from "@/lib/kanban-config";
import { ensureIndexes, getAutomationsCollection } from "@/lib/mongodb";
import type { EngagementStage } from "@/lib/types";

type RouteContext = { params: Promise<{ slug: string }> };

function parseRule(body: {
  ruleType?: string;
  stages?: EngagementStage[];
}): KanbanColumnRule | null {
  if (body.ruleType === "hot") return { type: "hot" };
  if (body.ruleType === "manual" || !body.ruleType) return { type: "manual" };
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

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const rule = parseRule(body);

    if (!title) {
      return NextResponse.json(
        { error: "Stage name is required" },
        { status: 400 }
      );
    }
    if (!rule) {
      return NextResponse.json({ error: "Invalid stage rule" }, { status: 400 });
    }

    await ensureIndexes();
    const automations = await getAutomationsCollection();
    const automation = await automations.findOne({ slug });

    if (!automation) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const existing = resolveKanbanColumns(
      automation.kanbanColumns,
      automation.channelType ?? "email"
    );
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

    return NextResponse.json({
      column: {
        id: newColumn.id,
        title: newColumn.title,
        description: newColumn.description,
        rule: newColumn.rule,
        color: newColumn.color,
        colorBg: newColumn.colorBg,
        prospects: [],
      },
      columns,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create stage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const body = await request.json();
    const columnIds = body.columnIds as string[] | undefined;

    if (!columnIds?.length) {
      return NextResponse.json(
        { error: "columnIds array is required" },
        { status: 400 }
      );
    }

    await ensureIndexes();
    const automations = await getAutomationsCollection();
    const automation = await automations.findOne({ slug });

    if (!automation) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const existing = resolveKanbanColumns(
      automation.kanbanColumns,
      automation.channelType ?? "email"
    );
    const byId = new Map(existing.map((col) => [col.id, col]));

    // Keep known stages in the requested order; append any missing at the end
    const seen = new Set<string>();
    const reordered: AutomationKanbanColumn[] = [];
    for (const id of columnIds) {
      const col = byId.get(id);
      if (col && !seen.has(id)) {
        reordered.push(col);
        seen.add(id);
      }
    }
    for (const col of existing) {
      if (!seen.has(col.id)) reordered.push(col);
    }

    if (!reordered.length) {
      return NextResponse.json({ error: "No stages to reorder" }, { status: 400 });
    }

    const columns = normalizeColumns(reordered);
    await automations.updateOne(
      { _id: automation._id },
      { $set: { kanbanColumns: columns } }
    );

    return NextResponse.json({ columns });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reorder stages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
