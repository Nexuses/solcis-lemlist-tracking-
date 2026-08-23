"use client";

import { useMemo, useState } from "react";
import {
  guessMapping,
  IMPORT_FIELD_OPTIONS,
  parseCsv,
  rowsToObjects,
  type ImportFieldKey,
} from "@/lib/csv";

interface StageOption {
  id: string;
  title: string;
}

export function CsvImportModal({
  boardSlug,
  stages,
  initialStageId,
  onClose,
  onImported,
}: {
  boardSlug: string;
  stages: StageOption[];
  initialStageId?: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ImportFieldKey>>({});
  const [columnId, setColumnId] = useState(
    initialStageId ?? stages[0]?.id ?? ""
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    skippedDuplicates?: number;
  } | null>(null);

  const previewRows = useMemo(() => rows.slice(0, 3), [rows]);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.headers.length) {
        throw new Error("Could not read CSV headers");
      }
      const objects = rowsToObjects(parsed.headers, parsed.rows);
      if (!objects.length) {
        throw new Error("CSV has no data rows");
      }

      const nextMapping: Record<string, ImportFieldKey> = {};
      for (const header of parsed.headers) {
        nextMapping[header] = guessMapping(header);
      }

      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(objects);
      setMapping(nextMapping);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read CSV");
      setHeaders([]);
      setRows([]);
      setFileName(null);
    }
  }

  async function handleImport() {
    if (!columnId || !rows.length) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/board/${boardSlug}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columnId,
          rows,
          mapping,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult({
        imported: data.imported,
        skipped: data.skipped,
        skippedDuplicates: data.skippedDuplicates ?? 0,
      });
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-[#ECECEA] px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1C1C1A]">
              Import CSV
            </h2>
            <p className="mt-0.5 text-[12px] text-[#8A8A85]">
              Upload a file, map columns, and choose the stage.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2.5 py-1 text-[12px] font-medium text-[#737373] hover:bg-[#F4F4F2]"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#D4D4D0] bg-[#FAFAF9] px-4 py-8 text-center transition hover:border-[#A3A3A3] hover:bg-[#F5F5F4]">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <p className="text-[13px] font-medium text-[#1C1C1A]">
              {fileName ? fileName : "Choose CSV file"}
            </p>
            <p className="mt-1 text-[11px] text-[#ABABA6]">
              {rows.length
                ? `${rows.length} rows ready`
                : "Headers in the first row"}
            </p>
          </label>

          {headers.length > 0 && (
            <>
              <label className="block text-sm">
                <span className="mb-1.5 block text-[12px] font-medium text-[#5C5C58]">
                  Put imported leads in stage
                </span>
                <select
                  value={columnId}
                  onChange={(e) => setColumnId(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E5E3] px-3 py-2 text-[13px] outline-none ring-[#4F46E5] focus:ring-2"
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.title}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <p className="mb-2 text-[12px] font-medium text-[#5C5C58]">
                  Map CSV columns
                </p>
                <div className="space-y-2">
                  {headers.map((header) => (
                    <div
                      key={header}
                      className="grid grid-cols-[1fr_1fr] items-center gap-3"
                    >
                      <p className="truncate rounded-lg bg-[#F5F5F4] px-3 py-2 text-[12px] font-medium text-[#1C1C1A]">
                        {header}
                      </p>
                      <select
                        value={mapping[header] ?? "skip"}
                        onChange={(e) =>
                          setMapping((prev) => ({
                            ...prev,
                            [header]: e.target.value as ImportFieldKey,
                          }))
                        }
                        className="rounded-lg border border-[#E5E5E3] px-3 py-2 text-[12px] outline-none ring-[#4F46E5] focus:ring-2"
                      >
                        {IMPORT_FIELD_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {previewRows.length > 0 && (
                <div>
                  <p className="mb-2 text-[12px] font-medium text-[#5C5C58]">
                    Preview
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-[#ECECEA]">
                    <table className="min-w-full text-left text-[11px]">
                      <thead className="bg-[#FAFAF9] text-[#8A8A85]">
                        <tr>
                          {headers.map((h) => (
                            <th key={h} className="px-3 py-2 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i} className="border-t border-[#F3F3F1]">
                            {headers.map((h) => (
                              <td
                                key={h}
                                className="max-w-[140px] truncate px-3 py-2 text-[#1C1C1A]"
                              >
                                {row[h] || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </div>
          )}
          {result && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
              Imported {result.imported} unique lead
              {result.imported === 1 ? "" : "s"}
              {(result.skippedDuplicates ?? 0) > 0
                ? ` · skipped ${result.skippedDuplicates} duplicate${
                    result.skippedDuplicates === 1 ? "" : "s"
                  }`
                : ""}
              {result.skipped - (result.skippedDuplicates ?? 0) > 0
                ? ` · skipped ${
                    result.skipped - (result.skippedDuplicates ?? 0)
                  } empty`
                : ""}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#ECECEA] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-[#737373] hover:bg-[#F5F5F4]"
          >
            {result ? "Done" : "Cancel"}
          </button>
          {!result && (
            <button
              type="button"
              disabled={importing || !rows.length || !columnId}
              onClick={() => void handleImport()}
              className="rounded-lg bg-[#1C1C1A] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-[#333] disabled:opacity-50"
            >
              {importing ? "Importing..." : `Import ${rows.length || ""} leads`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
