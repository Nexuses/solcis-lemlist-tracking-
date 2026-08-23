"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DetailFieldKey } from "@/lib/detail-fields";
import type { KanbanColumnRule } from "@/lib/kanban-config";
import {
  getColumnAccent,
  getEngagementCardStyle,
  isEngagedColumn,
} from "@/lib/kanban-config";
import { getDisplayName } from "@/lib/prospect-display";
import { CsvImportModal } from "@/components/CsvImportModal";
import {
  ProspectDetailModal,
  type BoardProspect,
} from "@/components/ProspectDetailModal";

export type { BoardProspect };

export interface KanbanColumn {
  id: string;
  title: string;
  description: string;
  rule: KanbanColumnRule;
  color?: string;
  colorBg?: string;
  prospects: BoardProspect[];
}

function RecordIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-3.5 w-3.5 text-[#B0B0AC]"
      aria-hidden
    >
      <path
        d="M3 2.5h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 3×3 grip (9 dots) for dragging stages */
function StageGripIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      {[4, 8, 12].flatMap((y) =>
        [4, 8, 12].map((x) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.15" fill="currentColor" />
        ))
      )}
    </svg>
  );
}

const STAGE_DRAG_MIME = "application/x-kanban-stage";

function ProspectCard({
  prospect,
  column,
  isDragging,
  onOpen,
}: {
  prospect: BoardProspect;
  column: KanbanColumn;
  isDragging: boolean;
  onOpen: () => void;
}) {
  const displayName = getDisplayName(prospect);
  const engageStyle =
    isEngagedColumn(column) || prospect.isHot
      ? getEngagementCardStyle(prospect.stage, prospect.isHot)
      : null;
  const dragMoved = useRef(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        dragMoved.current = false;
        e.dataTransfer.setData("text/plain", prospect.leadId);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDrag={(e) => {
        if (e.clientX !== 0 || e.clientY !== 0) dragMoved.current = true;
      }}
      onClick={() => {
        if (!dragMoved.current) onOpen();
      }}
      className={`flex cursor-grab items-center gap-2.5 rounded-lg border border-[#EBEBEA] bg-white px-2.5 py-2 text-left transition active:cursor-grabbing hover:border-[#DCDCD9] hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F5F5F4]">
        {prospect.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prospect.picture}
            alt=""
            className="h-7 w-7 rounded-md object-cover"
          />
        ) : (
          <RecordIcon />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight text-[#1C1C1A]">
          {displayName}
        </p>
        {prospect.email && (
          <p className="truncate text-[12px] leading-tight text-[#8A8A85]">
            {prospect.email}
          </p>
        )}
      </div>

      {engageStyle && (prospect.isHot || isEngagedColumn(column)) && (
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${engageStyle.dot}`}
          title={engageStyle.label}
        />
      )}
    </div>
  );
}

function EmptyColumnPlaceholder({ isOver }: { isOver: boolean }) {
  return (
    <div
      className={`rounded-lg border border-dashed px-3 py-2.5 text-center text-[12px] transition ${
        isOver
          ? "border-[#A3A3A3] bg-[#F5F5F4] text-[#5C5C58]"
          : "border-[#E0E0DC] bg-[#FAFAF9] text-[#ABABA6]"
      }`}
    >
      Drop here
    </div>
  );
}

function AddStageColumn({
  boardSlug,
  onCreated,
}: {
  boardSlug: string;
  onCreated: (column: KanbanColumn) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || saving) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/board/${boardSlug}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          ruleType: "manual",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create stage");

      onCreated(data.column as KanbanColumn);
      setTitle("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create stage");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-fit w-[272px] shrink-0 items-center gap-2 rounded-xl border border-dashed border-[#D4D4D0] bg-white/60 px-4 py-3 text-left text-[13px] font-medium text-[#8A8A85] transition hover:border-[#A3A3A3] hover:bg-white hover:text-[#1C1C1A]"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#F5F5F4] text-[#737373]">
          +
        </span>
        Add stage
      </button>
    );
  }

  return (
    <div className="flex w-[272px] shrink-0 flex-col rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/5">
      <p className="mb-2 text-[12px] font-semibold text-[#1C1C1A]">New stage</p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Meeting booked"
          autoFocus
          className="w-full rounded-lg border border-[#E5E5E3] px-3 py-2 text-[13px] text-[#1C1C1A] outline-none ring-[#4F46E5] focus:ring-2"
        />
        {error && <p className="text-[11px] text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-lg bg-[#1C1C1A] px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#333] disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setOpen(false);
              setTitle("");
              setError(null);
            }}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#737373] hover:bg-[#F5F5F4]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export function KanbanBoard({
  columns: initialColumns,
  boardSlug,
  detailFields,
  onRefresh,
}: {
  columns: KanbanColumn[];
  boardSlug: string;
  detailFields: DetailFieldKey[];
  onRefresh?: () => void;
}) {
  const [columns, setColumns] = useState(initialColumns);
  const [selected, setSelected] = useState<BoardProspect | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(
    null
  );
  const [moving, setMoving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [draggingStageId, setDraggingStageId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [importStageId, setImportStageId] = useState<string | null>(null);

  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  const moveProspect = useCallback(
    async (leadId: string, fromColumnId: string, toColumnId: string) => {
      if (fromColumnId === toColumnId || moving) return;

      let movedProspect: BoardProspect | undefined;
      const previous = columns;

      setColumns((prev) =>
        prev
          .map((col) => {
            if (col.id === fromColumnId) {
              movedProspect = col.prospects.find((p) => p.leadId === leadId);
              return {
                ...col,
                prospects: col.prospects.filter((p) => p.leadId !== leadId),
              };
            }
            return col;
          })
          .map((col) =>
            col.id === toColumnId && movedProspect
              ? {
                  ...col,
                  prospects: [
                    ...col.prospects,
                    { ...movedProspect, assignedColumnId: toColumnId },
                  ],
                }
              : col
          )
      );

      setMoving(true);
      try {
        const res = await fetch(
          `/api/board/${boardSlug}/prospects/${encodeURIComponent(leadId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ columnId: toColumnId }),
          }
        );
        if (!res.ok) {
          setColumns(previous);
          onRefresh?.();
        }
      } catch {
        setColumns(previous);
        onRefresh?.();
      } finally {
        setMoving(false);
      }
    },
    [boardSlug, columns, moving, onRefresh]
  );

  const persistStageOrder = useCallback(
    async (next: KanbanColumn[], previous: KanbanColumn[]) => {
      setReordering(true);
      try {
        const res = await fetch(`/api/board/${boardSlug}/columns`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            columnIds: next.map((col) => col.id),
          }),
        });
        if (!res.ok) {
          setColumns(previous);
          onRefresh?.();
        }
      } catch {
        setColumns(previous);
        onRefresh?.();
      } finally {
        setReordering(false);
      }
    },
    [boardSlug, onRefresh]
  );

  function reorderStages(fromId: string, toId: string) {
    if (fromId === toId || reordering) return;
    const fromIndex = columns.findIndex((col) => col.id === fromId);
    const toIndex = columns.findIndex((col) => col.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const previous = columns;
    const next = [...columns];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setColumns(next);
    void persistStageOrder(next, previous);
  }

  function handleDragOver(e: React.DragEvent, columnId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggingStageId) {
      setDragOverStageId(columnId);
      setDragOverColumnId(null);
    } else {
      setDragOverColumnId(columnId);
    }
  }

  function handleDrop(e: React.DragEvent, toColumnId: string) {
    e.preventDefault();
    const stagePayload =
      e.dataTransfer.getData(STAGE_DRAG_MIME) ||
      e.dataTransfer.getData("text/plain");
    const stageId = stagePayload.startsWith("stage:")
      ? stagePayload.slice("stage:".length)
      : e.dataTransfer.getData(STAGE_DRAG_MIME);

    if (stageId && columns.some((col) => col.id === stageId)) {
      setDragOverStageId(null);
      setDraggingStageId(null);
      reorderStages(stageId, toColumnId);
      return;
    }

    const leadId = e.dataTransfer.getData("text/plain");
    if (!leadId || leadId.startsWith("stage:")) return;

    const fromColumn = columns.find((col) =>
      col.prospects.some((p) => p.leadId === leadId)
    );
    setDragOverColumnId(null);
    setDraggingLeadId(null);

    if (fromColumn) {
      moveProspect(leadId, fromColumn.id, toColumnId);
    }
  }

  function handleStageCreated(column: KanbanColumn) {
    setColumns((prev) => [...prev, { ...column, prospects: [] }]);
    onRefresh?.();
  }

  return (
    <>
      <div className="flex h-[calc(100vh-120px)] min-h-[480px] gap-3 overflow-x-auto pb-2">
        {columns.map((column, index) => {
          const isOver =
            dragOverColumnId === column.id || dragOverStageId === column.id;
          const accent = getColumnAccent(column, index);
          const isStageDragging = draggingStageId === column.id;

          return (
            <section
              key={column.id}
              className={`flex w-[272px] shrink-0 flex-col rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition ${
                isOver ? "ring-2 ring-[#D4D4D0]" : ""
              } ${isStageDragging ? "opacity-40" : ""}`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={() => {
                setDragOverColumnId((id) => (id === column.id ? null : id));
                setDragOverStageId((id) => (id === column.id ? null : id));
              }}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <header className="mb-3 flex items-center gap-1.5">
                <button
                  type="button"
                  title="Drag to move stage"
                  draggable
                  disabled={reordering}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData(STAGE_DRAG_MIME, column.id);
                    e.dataTransfer.setData("text/plain", `stage:${column.id}`);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingStageId(column.id);
                  }}
                  onDragEnd={() => {
                    setDraggingStageId(null);
                    setDragOverStageId(null);
                  }}
                  className="flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-[#C4C4C0] transition hover:bg-[#F5F5F4] hover:text-[#737373] active:cursor-grabbing disabled:opacity-40"
                >
                  <StageGripIcon />
                </button>
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${accent.dot}`}
                />
                <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#1C1C1A]">
                  {column.title}
                </h2>
                <span className="rounded-md bg-[#F3F3F1] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[#737373]">
                  {column.prospects.length}
                </span>
                <button
                  type="button"
                  title="Import CSV into this stage"
                  onClick={() => setImportStageId(column.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[#8A8A85] transition hover:bg-[#F5F5F4] hover:text-[#1C1C1A]"
                >
                  +
                </button>
              </header>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
                {column.prospects.length === 0 ? (
                  <EmptyColumnPlaceholder isOver={dragOverColumnId === column.id} />
                ) : (
                  column.prospects.map((prospect) => (
                    <div
                      key={prospect.leadId}
                      onDragStart={() => setDraggingLeadId(prospect.leadId)}
                      onDragEnd={() => {
                        setDraggingLeadId(null);
                        setDragOverColumnId(null);
                      }}
                    >
                      <ProspectCard
                        prospect={prospect}
                        column={column}
                        isDragging={draggingLeadId === prospect.leadId}
                        onOpen={() => setSelected(prospect)}
                      />
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}

        <AddStageColumn boardSlug={boardSlug} onCreated={handleStageCreated} />
      </div>

      {selected && (
        <ProspectDetailModal
          prospect={selected}
          detailFields={detailFields}
          boardSlug={boardSlug}
          onClose={() => setSelected(null)}
          onDeleted={(leadId) => {
            setColumns((prev) =>
              prev.map((col) => ({
                ...col,
                prospects: col.prospects.filter((p) => p.leadId !== leadId),
              }))
            );
            setSelected(null);
            onRefresh?.();
          }}
        />
      )}

      {importStageId && (
        <CsvImportModal
          boardSlug={boardSlug}
          stages={columns.map((col) => ({ id: col.id, title: col.title }))}
          initialStageId={importStageId}
          onClose={() => setImportStageId(null)}
          onImported={() => {
            onRefresh?.();
          }}
        />
      )}
    </>
  );
}
