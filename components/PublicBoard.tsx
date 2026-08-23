"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_DETAIL_FIELDS,
  type DetailFieldKey,
} from "@/lib/detail-fields";
import { BoardUnlock } from "@/components/BoardUnlock";
import { KanbanBoard, type KanbanColumn } from "@/components/KanbanBoard";

interface BoardData {
  automation: {
    name: string;
    campaignName: string;
    slug: string;
    lastSyncedAt?: string;
    prospectCount: number;
  };
  columns: KanbanColumn[];
  detailFields?: DetailFieldKey[];
}

export function PublicBoard({ slug }: { slug: string }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/board/${slug}`);
      const json = await res.json();

      if (res.status === 401 && json.code === "BOARD_LOCKED") {
        setLocked(true);
        setData(null);
        setError(null);
        return;
      }

      if (!res.ok) {
        throw new Error(json.error ?? "Board not found");
      }

      setData(json);
      setLocked(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load board");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadBoard();
    const interval = setInterval(() => {
      if (!locked) loadBoard();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadBoard, locked]);

  if (locked) {
    return (
      <BoardUnlock
        onUnlocked={() => {
          setLoading(true);
          setLocked(false);
          loadBoard();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EFEFED] text-[13px] text-[#8A8A85]">
        Loading pipeline...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EFEFED] px-6">
        <div className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-[13px] text-[#B91C1C]">
          {error ?? "Board not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EFEFED]">
      <header className="sticky top-0 z-10 border-b border-[#E5E5E3] bg-white">
        <div className="mx-auto flex max-w-[100%] items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1C1C1A] text-[10px] font-bold text-white">
              LT
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[14px] font-semibold text-[#1C1C1A]">
                {data.automation.name}
              </h1>
              <p className="truncate text-[11px] text-[#8A8A85]">
                {data.automation.campaignName} · {data.automation.prospectCount}{" "}
                records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data.automation.lastSyncedAt && (
              <span className="hidden text-[11px] text-[#ABABA6] sm:inline">
                Updated {new Date(data.automation.lastSyncedAt).toLocaleString()}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                loadBoard().finally(() => setLoading(false));
              }}
              className="rounded-md border border-[#E5E5E3] bg-white px-2.5 py-1 text-[11px] font-medium text-[#5C5C58] transition hover:bg-[#F5F5F4]"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        <KanbanBoard
          columns={data.columns}
          boardSlug={slug}
          detailFields={data.detailFields ?? DEFAULT_DETAIL_FIELDS}
          onRefresh={loadBoard}
        />
      </main>
    </div>
  );
}
