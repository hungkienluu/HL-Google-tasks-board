"use client";

import { useState, useTransition } from "react";
import { quickAddTask } from "@/app/actions/syncEngine";
import { routingListKeys } from "@/lib/tasks/schema";

const listLabels: Record<string, string> = {
  default: "Default",
  family: "Family",
  homeImprovement: "Home Improvement",
  homeMaintenance: "Home Maintenance",
  square: "Square"
};

export function QuickAddBar() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [listKey, setListKey] = useState<string>("default");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;

    startTransition(async () => {
      await quickAddTask(title.trim(), notes.trim() || undefined, listKey);
      setTitle("");
      setNotes("");
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="card-surface flex flex-col gap-3 border-slate-200 p-4 shadow-none"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <input
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          name="title"
          placeholder="Quick Add (Gemini-style prompt)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          value={listKey}
          onChange={(e) => setListKey(e.target.value)}
        >
          {routingListKeys.map((key) => (
            <option key={key} value={key}>
              {listLabels[key] ?? key}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Adding..." : "Add"}
        </button>
      </div>
      <textarea
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        name="notes"
        placeholder="Notes (optional)"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
    </form>
  );
}
