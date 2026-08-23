"use client";

import { useState } from "react";

export function BoardUnlock({
  onUnlocked,
}: {
  onUnlocked: () => void;
}) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/board/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid secret");
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EFEFED] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E5E5E3] bg-white p-8 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ABABA6]">
          Protected board
        </p>
        <h1 className="mt-2 text-xl font-semibold text-[#1C1C1A]">
          Enter access secret
        </h1>
        <p className="mt-1 text-[13px] text-[#8A8A85]">
          Ask the board owner for the access secret to view this pipeline.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-[#5C5C58]">
              Board access secret
            </span>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
              autoComplete="off"
              className="w-full rounded-lg border border-[#E5E5E3] px-3 py-2 text-[#1C1C1A] outline-none ring-[#4F46E5] focus:ring-2"
              placeholder="BOARD_ACCESS_SECRET"
            />
          </label>

          <button
            type="submit"
            disabled={loading || !secret.trim()}
            className="w-full rounded-lg bg-[#1C1C1A] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#333] disabled:opacity-50"
          >
            {loading ? "Unlocking..." : "Unlock board"}
          </button>
        </form>
      </div>
    </div>
  );
}
