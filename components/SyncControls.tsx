"use client";

import { useTransition } from "react";
import { bulkArchiveCompleted, syncDefaultList } from "@/app/actions/syncEngine";

export function SyncControls() {
  const [isPending, startTransition] = useTransition();

  const handleSync = () => {
    startTransition(async () => {
      await syncDefaultList();
    });
  };

  const handleArchive = () => {
    startTransition(async () => {
      await bulkArchiveCompleted();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Syncing..." : "Run Triage Engine"}
      </button>
      <button
        type="button"
        onClick={handleArchive}
        disabled={isPending}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Cleaning..." : "Bulk Cleanup (Archive Completed)"}
      </button>
    </div>
  );
}
