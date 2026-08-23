"use client";

import { useState } from "react";
import type { DetailFieldKey } from "@/lib/detail-fields";
import {
  buildConfiguredDetailRows,
  type DetailRow,
} from "@/lib/detail-fields";
import { getEngagementCardStyle } from "@/lib/kanban-config";
import { getDisplayName } from "@/lib/prospect-display";
import type { EngagementStage } from "@/lib/types";

export interface BoardProspect {
  leadId: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  companyDomain?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  picture?: string | null;
  emailStatus?: string | null;
  timezone?: string | null;
  icebreaker?: string | null;
  state?: string | null;
  lastState?: string | null;
  status?: string | null;
  contactId?: string | null;
  customFields?: Record<string, string>;
  isHot?: boolean;
  assignedColumnId?: string | null;
  stage?: EngagementStage;
  openCount: number;
  clickCount: number;
  hasReplied: boolean;
  hasInviteAccepted?: boolean;
  lastActivityAt?: string | null;
}

function initials(prospect: BoardProspect): string {
  const name = getDisplayName(prospect);
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function DetailValue({ row }: { row: DetailRow }) {
  if (row.isEmpty) {
    return <span className="text-[13px] text-[#C4C4C0]">{row.value}</span>;
  }

  if (row.href) {
    return (
      <a
        href={row.href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-[13px] font-medium text-[#4F46E5] hover:underline"
      >
        {row.value}
      </a>
    );
  }

  return (
    <span className="break-words text-[13px] font-medium text-[#1C1C1A]">
      {row.value}
    </span>
  );
}

export function ProspectDetailModal({
  prospect,
  detailFields,
  boardSlug,
  onClose,
  onDeleted,
}: {
  prospect: BoardProspect;
  detailFields: DetailFieldKey[];
  boardSlug: string;
  onClose: () => void;
  onDeleted?: (leadId: string) => void;
}) {
  const displayName = getDisplayName(prospect);
  const rows = buildConfiguredDetailRows(prospect, detailFields);
  const engageStyle = getEngagementCardStyle(prospect.stage, prospect.isHot);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (deleting) return;
    if (!confirm(`Delete ${displayName} from this board?`)) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/board/${boardSlug}/prospects/${encodeURIComponent(prospect.leadId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      onDeleted?.(prospect.leadId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-[3px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-full w-full max-w-[420px] flex-col bg-[#FAFAF9] shadow-[-12px_0_40px_rgba(0,0,0,0.08)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prospect-detail-title"
      >
        <div className="flex items-center justify-between border-b border-[#ECECEA] bg-white px-5 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#ABABA6]">
            Prospect details
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2.5 py-1 text-[12px] font-medium text-[#737373] transition hover:bg-[#F4F4F2] hover:text-[#1C1C1A]"
          >
            Close
          </button>
        </div>

        <div className="border-b border-[#ECECEA] bg-white px-5 py-5">
          <div className="flex items-center gap-3.5">
            {prospect.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={prospect.picture}
                alt=""
                className="h-12 w-12 rounded-xl object-cover ring-1 ring-[#ECECEA]"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] text-sm font-bold text-[#4F46E5] ring-1 ring-[#ECECEA]">
                {initials(prospect)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2
                id="prospect-detail-title"
                className="truncate text-[17px] font-semibold text-[#1C1C1A]"
              >
                {displayName}
              </h2>
              <p className="truncate text-[13px] text-[#8A8A85]">
                {prospect.email?.trim() || "—"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {prospect.isHot && (
              <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700 ring-1 ring-orange-200/80">
                Hot
              </span>
            )}
            {(prospect.stage === "inviteAccepted" ||
              prospect.stage === "opened" ||
              prospect.stage === "clicked" ||
              prospect.stage === "replied") && (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${engageStyle.badge}`}
              >
                {engageStyle.label}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="overflow-hidden rounded-xl border border-[#ECECEA] bg-white">
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-[#ABABA6]">
                No details available
              </p>
            ) : (
              rows.map((row, index) => (
                <div
                  key={row.key}
                  className={`flex items-start justify-between gap-4 px-4 py-3.5 ${
                    index < rows.length - 1 ? "border-b border-[#F3F3F1]" : ""
                  }`}
                >
                  <p className="w-[120px] shrink-0 text-[12px] font-medium text-[#8A8A85]">
                    {row.label}
                  </p>
                  <div className="min-w-0 flex-1 text-right">
                    <DetailValue row={row} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-[#ECECEA] bg-white px-5 py-4">
          {error && (
            <p className="mb-3 text-right text-[12px] text-red-600">{error}</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-[13px] font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
