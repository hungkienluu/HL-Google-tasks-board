"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { Task } from "@/lib/tasks/schema";
import { routingListKeys } from "@/lib/tasks/schema";

const listLabels: Record<string, string> = {
  family: "Family",
  homeImprovement: "Home Improvement",
  homeMaintenance: "Home Maintenance",
  square: "Square"
};

const urgencyStyles: Record<Task["urgency"], string> = {
  high: "task-border-high",
  medium: "task-border-medium",
  low: "task-border-low text-slate-500"
};

type BoardViewProps = {
  tasksByList: Record<string, Task[]>;
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

export function BoardView({ tasksByList }: BoardViewProps) {
  const [activeList, setActiveList] = useState<string>("family");

  const columns = useMemo(() => {
    return routingListKeys
      .filter((key) => key !== "default")
      .map((key) => ({
        key,
        label: listLabels[key] ?? key,
        tasks: tasksByList[key] ?? []
      }));
  }, [tasksByList]);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => (
          <div key={column.key} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{column.label}</h2>
              <span className="text-xs text-slate-500">{column.tasks.length} tasks</span>
            </div>
            <div className="flex flex-col gap-3">
              {column.tasks
                .sort((a, b) => (a.urgency === "high" ? -1 : b.urgency === "high" ? 1 : 0))
                .map((task) => (
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
    </div>
  );
}
