"use client";

import { useCallback, useEffect, useState } from "react";
import type { AutomationKanbanColumn } from "@/lib/kanban-config";
import { ALL_ENGAGEMENT_STAGES } from "@/lib/kanban-config";
import type { EngagementStage } from "@/lib/types";

interface KanbanColumnEditorProps {
  automationId: string;
  onError: (message: string) => void;
}

function reorderColumns(
  columns: AutomationKanbanColumn[],
  fromIndex: number,
  toIndex: number
): AutomationKanbanColumn[] {
  if (toIndex < 0 || toIndex >= columns.length) return columns;
  const next = [...columns];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((col, index) => ({ ...col, order: index }));
}

export function KanbanColumnEditor({
  automationId,
  onError,
}: KanbanColumnEditorProps) {
  const [columns, setColumns] = useState<AutomationKanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newRuleType, setNewRuleType] = useState<"hot" | "stages" | "manual">(
    "manual"
  );
  const [newStages, setNewStages] = useState<EngagementStage[]>(["opened"]);

  const loadColumns = useCallback(async () => {
    try {
      const res = await fetch(`/api/automations/${automationId}/columns`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load columns");
      setColumns(data.columns ?? []);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load columns");
    } finally {
      setLoading(false);
    }
  }, [automationId, onError]);

  useEffect(() => {
    if (expanded) loadColumns();
  }, [expanded, loadColumns]);

  async function persistColumns(nextColumns: AutomationKanbanColumn[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/automations/${automationId}/columns`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: nextColumns }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save column order");
      setColumns(data.columns);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save columns");
      await loadColumns();
    } finally {
      setSaving(false);
    }
  }

  async function handleMoveColumn(index: number, direction: "up" | "down") {
    const toIndex = direction === "up" ? index - 1 : index + 1;
    const next = reorderColumns(columns, index, toIndex);
    setColumns(next);
    await persistColumns(next);
  }

  async function handleAddColumn(event: React.FormEvent) {
    event.preventDefault();
    if (!newTitle.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/automations/${automationId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          ruleType: newRuleType,
          stages: newRuleType === "stages" ? newStages : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add column");
      setColumns(data.columns);
      setNewTitle("");
      setNewDescription("");
      setNewRuleType("manual");
      setNewStages(["opened"]);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to add column");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteColumn(columnId: string) {
    if (!confirm("Remove this column from the board?")) return;

    setSaving(true);
    try {
      const res = await fetch(
        `/api/automations/${automationId}/columns?columnId=${encodeURIComponent(columnId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete column");
      setColumns(data.columns);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete column");
    } finally {
      setSaving(false);
    }
  }

  function toggleStage(stage: EngagementStage) {
    setNewStages((prev) =>
      prev.includes(stage)
        ? prev.filter((s) => s !== stage)
        : [...prev, stage]
    );
  }

  function ruleLabel(column: AutomationKanbanColumn): string {
    if (column.rule.type === "hot") return "Hot leads";
    if (column.rule.type === "manual") return "Manual (drag only)";
    return column.rule.stages
      .map((s) => ALL_ENGAGEMENT_STAGES.find((x) => x.value === s)?.label ?? s)
      .join(", ");
  }

  return (
    <div className="mt-4 border-t border-[#ECECEA] pt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-[13px] font-medium text-[#4F46E5] hover:underline"
      >
        {expanded ? "Hide Kanban columns" : "Edit Kanban columns"}
      </button>

      {expanded && (
        <div className="mt-3 space-y-4">
          {loading ? (
            <p className="text-[12px] text-[#8A8A85]">Loading columns...</p>
          ) : (
            <>
              <div>
                <p className="mb-2 text-[12px] font-medium text-[#5C5C58]">
                  Column sequence
                  <span className="ml-1 font-normal text-[#ABABA6]">
                    — first match wins (left → right)
                  </span>
                </p>
                <ul className="space-y-2">
                  {columns.map((column, index) => (
                    <li
                      key={column.id}
                      className="flex items-center gap-2 rounded-[8px] border border-[#ECECEA] bg-[#FAFAF9] px-3 py-2"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#F4F4F2] text-[11px] font-semibold tabular-nums text-[#5C5C58]">
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-[#1C1C1A]">
                          {column.title}
                        </p>
                        <p className="text-[11px] text-[#8A8A85]">
                          {column.description || ruleLabel(column)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          title="Move left"
                          disabled={saving || index === 0}
                          onClick={() => handleMoveColumn(index, "up")}
                          className="rounded-md border border-[#ECECEA] bg-white px-2 py-1 text-[11px] font-medium text-[#5C5C58] transition hover:bg-[#F4F4F2] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          title="Move right"
                          disabled={saving || index === columns.length - 1}
                          onClick={() => handleMoveColumn(index, "down")}
                          className="rounded-md border border-[#ECECEA] bg-white px-2 py-1 text-[11px] font-medium text-[#5C5C58] transition hover:bg-[#F4F4F2] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          disabled={saving || columns.length <= 1}
                          onClick={() => handleDeleteColumn(column.id)}
                          className="rounded-md px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <form
                onSubmit={handleAddColumn}
                className="rounded-[10px] border border-dashed border-[#D4D4D0] bg-white p-4"
              >
                <p className="mb-3 text-[12px] font-semibold text-[#1C1C1A]">
                  Add column
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[12px]">
                    <span className="font-medium text-[#5C5C58]">Name</span>
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Follow up"
                      className="rounded-[8px] border border-[#ECECEA] px-3 py-2 text-[13px]"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px]">
                    <span className="font-medium text-[#5C5C58]">Description</span>
                    <input
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Optional"
                      className="rounded-[8px] border border-[#ECECEA] px-3 py-2 text-[13px]"
                    />
                  </label>
                </div>

                <div className="mt-3">
                  <p className="mb-2 text-[12px] font-medium text-[#5C5C58]">
                    Column type
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-[8px] border border-[#ECECEA] px-3 py-2 text-[12px]">
                      <input
                        type="radio"
                        name={`rule-${automationId}`}
                        checked={newRuleType === "manual"}
                        onChange={() => setNewRuleType("manual")}
                      />
                      Manual (drag only)
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-[8px] border border-[#ECECEA] px-3 py-2 text-[12px]">
                      <input
                        type="radio"
                        name={`rule-${automationId}`}
                        checked={newRuleType === "hot"}
                        onChange={() => setNewRuleType("hot")}
                      />
                      Hot leads
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-[8px] border border-[#ECECEA] px-3 py-2 text-[12px]">
                      <input
                        type="radio"
                        name={`rule-${automationId}`}
                        checked={newRuleType === "stages"}
                        onChange={() => setNewRuleType("stages")}
                      />
                      By engagement stage
                    </label>
                  </div>
                </div>

                {newRuleType === "stages" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ALL_ENGAGEMENT_STAGES.map((stage) => (
                      <label
                        key={stage.value}
                        className={`cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset ${
                          newStages.includes(stage.value)
                            ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
                            : "bg-white text-[#8A8A85] ring-[#ECECEA]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={newStages.includes(stage.value)}
                          onChange={() => toggleStage(stage.value)}
                        />
                        {stage.label}
                      </label>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving || (newRuleType === "stages" && !newStages.length)}
                  className="mt-4 rounded-[8px] bg-[#1C1C1A] px-4 py-2 text-[12px] font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Add column"}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
