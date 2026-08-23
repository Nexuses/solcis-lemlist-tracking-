"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_DETAIL_FIELDS,
  DETAIL_FIELD_CATALOG,
  DETAIL_FIELD_GROUPS,
  type DetailFieldKey,
} from "@/lib/detail-fields";

interface DetailFieldsEditorProps {
  automationId: string;
  onError: (message: string) => void;
}

export function DetailFieldsEditor({
  automationId,
  onError,
}: DetailFieldsEditorProps) {
  const [enabled, setEnabled] = useState<DetailFieldKey[]>(DEFAULT_DETAIL_FIELDS);
  const [defaults, setDefaults] = useState<DetailFieldKey[]>(DEFAULT_DETAIL_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadFields = useCallback(async () => {
    try {
      const res = await fetch(`/api/automations/${automationId}/detail-fields`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load fields");
      const nextDefaults = data.defaults ?? DEFAULT_DETAIL_FIELDS;
      setDefaults(nextDefaults);
      setEnabled(data.detailFields ?? nextDefaults);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load fields");
    } finally {
      setLoading(false);
    }
  }, [automationId, onError]);

  useEffect(() => {
    if (expanded) loadFields();
  }, [expanded, loadFields]);

  async function persistFields(next: DetailFieldKey[]) {
    if (next.length === 0) {
      onError("Select at least one field");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/automations/${automationId}/detail-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detailFields: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save fields");
      setEnabled(data.detailFields);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save fields");
      await loadFields();
    } finally {
      setSaving(false);
    }
  }

  function toggleField(key: DetailFieldKey) {
    const next = enabled.includes(key)
      ? enabled.filter((k) => k !== key)
      : [...enabled, key];
    setEnabled(next);
    void persistFields(next);
  }

  function resetDefaults() {
    setEnabled(defaults);
    void persistFields(defaults);
  }

  return (
    <div className="mt-4 border-t border-[#ECECEA] pt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-[13px] font-medium text-[#4F46E5] hover:underline"
      >
        {expanded ? "Hide detail fields" : "Configure detail fields"}
      </button>

      {expanded && (
        <div className="mt-3 space-y-4">
          {loading ? (
            <p className="text-[12px] text-[#8A8A85]">Loading fields...</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-[#8A8A85]">
                  Choose what appears when clicking a prospect on the board.
                  Empty values show <span className="font-medium">—</span>
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={resetDefaults}
                  className="shrink-0 text-[11px] font-medium text-[#737373] hover:text-[#1C1C1A]"
                >
                  Reset defaults
                </button>
              </div>

              {DETAIL_FIELD_GROUPS.map((group) => {
                const fields = DETAIL_FIELD_CATALOG.filter(
                  (f) => f.group === group.id
                );
                if (!fields.length) return null;

                return (
                  <div key={group.id}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#ABABA6]">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {fields.map((field) => {
                        const isOn = enabled.includes(field.key);
                        return (
                          <button
                            key={field.key}
                            type="button"
                            disabled={saving}
                            onClick={() => toggleField(field.key)}
                            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition ring-1 ring-inset ${
                              isOn
                                ? "bg-[#1C1C1A] text-white ring-[#1C1C1A]"
                                : "bg-white text-[#5C5C58] ring-[#ECECEA] hover:bg-[#F5F5F4]"
                            }`}
                          >
                            {field.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
