"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { Task, TaskListWithTasks } from "@/lib/tasks/schema";

const urgencyStyles: Record<Task["urgency"], string> = {
  high: "task-border-high",
  medium: "task-border-medium",
  low: "task-border-low text-slate-500"
};

type BoardViewProps = {
  tasklists: TaskListWithTasks[];
};

function TaskCard({ task }: { task: Task }) {
  return (
    <article
      className={clsx(
        "card-surface border-l-4 p-3 transition hover:-translate-y-0.5",
        urgencyStyles[task.urgency]
      )}
    >
      <h3 className={clsx("text-sm font-semibold", task.urgency === "high" && "text-red-600")}>{task.title}</h3>
      {task.notes ? (
        <p className="mt-1 text-xs text-slate-600 line-clamp-2 whitespace-pre-line">{task.notes}</p>
      ) : null}
      <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
        <span>{task.urgency === "high" ? "🔥 This Week" : task.urgency === "medium" ? "Next" : "Later"}</span>
        <span>{task.status === "completed" ? "Done" : "Active"}</span>
      </div>
    </article>
  );
}

export function BoardView({ tasklists }: BoardViewProps) {
  const [visibleListIds, setVisibleListIds] = useState<string[]>(() => {
    const nonDefault = tasklists.filter((list) => !list.isDefault).map((list) => list.id);
    return nonDefault.length > 0 ? nonDefault : tasklists.map((list) => list.id);
  });
  const [activeList, setActiveList] = useState<string>(tasklists[0]?.id ?? "");

  useEffect(() => {
    const defaults = tasklists.filter((list) => !list.isDefault).map((list) => list.id);
    const fallback = defaults.length > 0 ? defaults : tasklists.map((list) => list.id);
    setVisibleListIds((current) => {
      if (current.length === 0) return fallback;
      const stillVisible = current.filter((id) => tasklists.some((list) => list.id === id));
      return stillVisible.length > 0 ? stillVisible : fallback;
    });
  }, [tasklists]);

  useEffect(() => {
    const firstVisible = visibleListIds.find((id) => tasklists.some((list) => list.id === id));
    if (firstVisible) {
      setActiveList(firstVisible);
    }
  }, [visibleListIds, tasklists]);

  const toggleList = (id: string) => {
    setVisibleListIds((current) => {
      const isSelected = current.includes(id);
      if (isSelected) {
        const next = current.filter((item) => item !== id);
        return next.length > 0 ? next : current;
      }
      return [...current, id];
    });
  };

  const columns = useMemo(
    () =>
      tasklists
        .map((list) => ({
          key: list.id,
          label: list.title,
          tasks: [...(list.tasks ?? [])].sort((a, b) =>
            a.urgency === "high" ? -1 : b.urgency === "high" ? 1 : 0
          )
        }))
        .filter((column) => visibleListIds.includes(column.key)),
    [tasklists, visibleListIds]
  );

  const hasColumns = columns.length > 0;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {tasklists.map((list) => (
          <button
            key={list.id}
            type="button"
            onClick={() => toggleList(list.id)}
            className={clsx(
              "rounded-full border px-3 py-1 text-xs font-semibold transition",
              visibleListIds.includes(list.id)
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            )}
          >
            {list.title}
          </button>
        ))}
      </div>

      {hasColumns ? (
        <>
          <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
            {columns.map((column) => (
              <div key={column.key} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">{column.label}</h2>
                  <span className="text-xs text-slate-500">{column.tasks.length} tasks</span>
                </div>
                <div className="flex flex-col gap-3">
                  {column.tasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="md:hidden">
            <div className="card-surface mb-3 grid grid-cols-4 text-center text-xs font-medium text-slate-600">
              {columns.map((column) => (
                <button
                  key={column.key}
                  className={clsx(
                    "px-2 py-2",
                    activeList === column.key && "border-b-2 border-slate-900 text-slate-900"
                  )}
                  onClick={() => setActiveList(column.key)}
                  type="button"
                >
                  {column.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {columns
                .find((column) => column.key === activeList)
                ?.tasks.map((task) => <TaskCard key={task.id} task={task} />)}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-600">No lists selected. Choose at least one list to view tasks.</p>
      )}
    </div>
  );
}
