"use client";

import { useCallback, useEffect, useState } from "react";
import { KanbanColumnEditor } from "@/components/KanbanColumnEditor";
import { DetailFieldsEditor } from "@/components/DetailFieldsEditor";

interface Campaign {
  _id: string;
  name: string;
  status?: string;
}

export interface AutomationItem {
  _id: string;
  name: string;
  slug: string;
  campaignId: string;
  campaignName: string;
  channelType?: "email" | "linkedin";
  createdAt: string;
  lastSyncedAt?: string;
  prospectCount?: number;
}

export function AutomationDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [automations, setAutomations] = useState<AutomationItem[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [channelType, setChannelType] = useState<"email" | "linkedin">(
    "email"
  );
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [meRes, campaignsRes, automationsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/campaigns"),
        fetch("/api/automations"),
      ]);

      const meData = await meRes.json();
      const campaignsData = await campaignsRes.json();
      const automationsData = await automationsRes.json();

      if (!meRes.ok) {
        window.location.href = "/login";
        return;
      }

      if (!campaignsRes.ok) {
        throw new Error(campaignsData.error ?? "Failed to load campaigns");
      }
      if (!automationsRes.ok) {
        throw new Error(automationsData.error ?? "Failed to load automations");
      }

      setUserName(meData.user?.name ?? meData.user?.email ?? null);
      setCampaigns(campaignsData.campaigns ?? []);
      setAutomations(automationsData.automations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !campaignId) return;

    setCreating(true);
    setError(null);

    const campaign = campaigns.find((c) => c._id === campaignId);

    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          campaignId,
          campaignName: campaign?.name,
          channelType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create automation");
      }

      setName("");
      setCampaignId("");
      setChannelType("email");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function handleSync(id: string) {
    setSyncingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/automations/${id}/sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Sync failed");
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this automation and all its prospect data?")) return;

    setError(null);
    try {
      const res = await fetch(`/api/automations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Delete failed");
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function copyPublicLink(slug: string) {
    const url = `${window.location.origin}/board/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Lemlist Automations
          </h1>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Select a campaign, capture all leads, and track opens & clicks on a
            public Kanban board you can share with your team.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {userName && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {userName}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        Public boards are locked with{" "}
        <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/60">
          BOARD_ACCESS_SECRET
        </code>{" "}
        from your <code className="text-xs">.env.local</code>. Share the board
        link and that secret with your team.
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Create automation
        </h2>
        <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Automation name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q1 Outreach Tracker"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-indigo-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              required
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Lemlist campaign
            </span>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-indigo-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              required
            >
              <option value="">Select a campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign._id} value={campaign._id}>
                  {campaign.name}
                  {campaign.status ? ` (${campaign.status})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Automation type
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setChannelType("email")}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  channelType === "email"
                    ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/30"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Email automation
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Hot · Engage · Contacted · Prospects
                </p>
              </button>
              <button
                type="button"
                onClick={() => setChannelType("linkedin")}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  channelType === "linkedin"
                    ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/30"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  LinkedIn automation
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Prospect · Contact · Invite accepted · Opened · Clicked ·
                  Replied
                </p>
              </button>
            </div>
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating || !name.trim() || !campaignId}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating & syncing..." : "Create automation"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Your automations
        </h2>

        {automations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-12 text-center text-zinc-500 dark:border-zinc-700">
            No automations yet. Create one above to start tracking engagement.
          </div>
        ) : (
          <div className="grid gap-4">
            {automations.map((automation) => (
              <article
                key={automation._id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {automation.name}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Campaign: {automation.campaignName}
                      {automation.channelType === "linkedin"
                        ? " · LinkedIn"
                        : " · Email"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {automation.prospectCount ?? 0} prospects
                      {automation.lastSyncedAt &&
                        ` · Last synced ${new Date(automation.lastSyncedAt).toLocaleString()}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/board/${automation.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Open board
                    </a>
                    <button
                      type="button"
                      onClick={() => copyPublicLink(automation.slug)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {copiedSlug === automation.slug ? "Copied!" : "Copy link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSync(automation._id)}
                      disabled={syncingId === automation._id}
                      className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    >
                      {syncingId === automation._id ? "Syncing..." : "Sync now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(automation._id)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <KanbanColumnEditor
                  automationId={automation._id}
                  onError={setError}
                />
                <DetailFieldsEditor
                  automationId={automation._id}
                  onError={setError}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
