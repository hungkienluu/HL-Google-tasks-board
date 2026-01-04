"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import type { Task, TaskListWithTasks } from "@/lib/tasks/schema";
import { moveTasksToList } from "@/app/actions/syncEngine";

const urgencyStyles: Record<Task["urgency"], string> = {
  high: "task-border-high",
  medium: "task-border-medium",
  low: "task-border-low text-slate-500"
};

type BoardViewProps = {
  tasklists: TaskListWithTasks[];
};

type SelectionState = Set<string>;

function TaskCard({
  task,
  isSelected,
  onToggle
}: {
  task: Task;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="group relative block">
      <input
        type="checkbox"
        className="peer absolute left-2 top-2 h-4 w-4 accent-slate-900"
        checked={isSelected}
        onChange={onToggle}
        aria-label={`Select task ${task.title}`}
      />
      <article
        className={clsx(
          "card-surface border-l-4 p-3 pl-8 transition hover:-translate-y-0.5 peer-checked:ring-2 peer-checked:ring-slate-200 peer-checked:ring-offset-1",
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
    </label>
  );
}

export function BoardView({ tasklists }: BoardViewProps) {
  const [visibleListIds, setVisibleListIds] = useState<string[]>(() => {
    const nonDefault = tasklists.filter((list) => !list.isDefault).map((list) => list.id);
    return nonDefault.length > 0 ? nonDefault : tasklists.map((list) => list.id);
  });
  const [activeList, setActiveList] = useState<string>(tasklists[0]?.id ?? "");
  const [selectedTaskIds, setSelectedTaskIds] = useState<SelectionState>(new Set());
  const [destinationListId, setDestinationListId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

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

  useEffect(() => {
    const selectionListIds = Array.from(selectedTaskIds).map((key) => key.split(":")[0]);
    const uniqueListIds = Array.from(new Set(selectionListIds));
    const firstDifferentList = tasklists.find((list) => list.id !== uniqueListIds[0]);
    if (!destinationListId && firstDifferentList) {
      setDestinationListId(firstDifferentList.id);
    }
    if (destinationListId && selectionListIds.length > 0 && uniqueListIds.includes(destinationListId)) {
      const alternative = tasklists.find((list) => list.id !== uniqueListIds[0]);
      if (alternative) setDestinationListId(alternative.id);
    }
  }, [destinationListId, selectedTaskIds, tasklists]);

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

  const selectedTasks = useMemo(
    () =>
      tasklists
        .flatMap((list) => list.tasks.map((task) => ({ ...task, listId: list.id })))
        .filter((task) => selectedTaskIds.has(`${task.listId}:${task.id}`)),
    [selectedTaskIds, tasklists]
  );

  const selectedListIds = useMemo(
    () => Array.from(new Set(selectedTasks.map((task) => task.listId))),
    [selectedTasks]
  );

  const singleSourceListId = selectedListIds.length === 1 ? selectedListIds[0] : null;

  const handleToggleTask = (listId: string, taskId: string) => {
    const key = `${listId}:${taskId}`;
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleToggleAllInList = (listId: string, tasks: Task[]) => {
    setSelectedTaskIds((current) => {
      const allKeys = tasks.map((task) => `${listId}:${task.id}`);
      const hasAllSelected = allKeys.every((key) => current.has(key));
      const next = new Set(current);
      if (hasAllSelected) {
        allKeys.forEach((key) => next.delete(key));
      } else {
        allKeys.forEach((key) => next.add(key));
      }
      return next;
    });
  };

  const handleMove = () => {
    if (!destinationListId || !singleSourceListId || selectedTasks.length === 0) return;
    startTransition(async () => {
      await moveTasksToList(destinationListId, selectedTasks);
      setSelectedTaskIds(new Set());
    });
  };

  const clearSelection = () => setSelectedTaskIds(new Set());

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
          <div
            className={clsx(
              "card-surface flex flex-col gap-3 border-slate-200 p-4 text-sm shadow-none md:flex-row md:items-center md:justify-between",
              selectedTasks.length > 0 ? "opacity-100" : "opacity-80"
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {selectedTasks.length} selected
              </span>
              {singleSourceListId ? (
                <span className="text-xs text-slate-600">
                  Moving from <strong>{tasklists.find((list) => list.id === singleSourceListId)?.title}</strong>
                </span>
              ) : selectedTasks.length > 0 ? (
                <span className="text-xs text-amber-600">
                  Select tasks from a single list to move together.
                </span>
              ) : (
                <span className="text-xs text-slate-600">Select tasks to move them to another list.</span>
              )}
            </div>
            <div className="flex flex-col items-start gap-2 md:flex-row md:items-center">
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                value={destinationListId}
                onChange={(e) => setDestinationListId(e.target.value)}
                disabled={!singleSourceListId || isPending}
              >
                <option value="" disabled>
                  Choose destination
                </option>
                {tasklists
                  .filter((list) => list.id !== singleSourceListId)
                  .map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.title}
                    </option>
                  ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleMove}
                  disabled={!singleSourceListId || !destinationListId || selectedTasks.length === 0 || isPending}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Moving..." : "Move Selected"}
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={selectedTasks.length === 0 || isPending}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
            {columns.map((column) => (
              <div key={column.key} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">{column.label}</h2>
                  <span className="text-xs text-slate-500">{column.tasks.length} tasks</span>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <button
                      type="button"
                      onClick={() => handleToggleAllInList(column.key, column.tasks)}
                      className="rounded-lg px-2 py-1 font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      {column.tasks.every((task) => selectedTaskIds.has(`${column.key}:${task.id}`))
                        ? "Unselect all"
                        : "Select all"}
                    </button>
                    <span>
                      {column.tasks.filter((task) => selectedTaskIds.has(`${column.key}:${task.id}`)).length} selected
                    </span>
                  </div>
                  {column.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isSelected={selectedTaskIds.has(`${column.key}:${task.id}`)}
                      onToggle={() => handleToggleTask(column.key, task.id)}
                    />
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
                ?.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isSelected={selectedTaskIds.has(`${activeList}:${task.id}`)}
                    onToggle={() => handleToggleTask(activeList, task.id)}
                  />
                ))}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-600">No lists selected. Choose at least one list to view tasks.</p>
      )}
    </div>
  );
}
