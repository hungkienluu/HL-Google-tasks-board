"use client";

import {
  forwardRef,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  type DraggableAttributes,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import type { Task, TaskListWithTasks } from "@/lib/tasks/schema";
import {
  clearCompletedInList,
  moveTasksToList,
  reorderTask,
  syncDefaultList
} from "@/app/actions/syncEngine";

const urgencyStyles: Record<Task["urgency"], string> = {
  high: "task-border-high",
  medium: "task-border-medium",
  low: "task-border-low text-slate-500"
};

type BoardViewProps = {
  tasklists: TaskListWithTasks[];
};

type SelectionState = Set<string>;
type SortableTaskMeta = { task: Task; listId: string };
type ActiveDragTask = { task: Task; listTitle: string; listId: string } | null;
type ViewKey = "desktop" | "mobile";

type TaskCardProps = {
  task: Task;
  listTitle: string;
  isSelected: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  dragOverlay?: boolean;
  onToggle: () => void;
  onViewDetails: () => void;
  handleProps?: DraggableAttributes & Record<string, unknown>;
  style?: CSSProperties;
};

const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(function TaskCard(
  {
    task,
    listTitle,
    isSelected,
    isDragging = false,
    isDropTarget = false,
    dragOverlay = false,
    onToggle,
    onViewDetails,
    handleProps,
    style
  },
  ref
) {
  const handleViewDetails = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onViewDetails();
  };

  const handlePointerStop = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  return (
    <motion.div
      layout
      ref={ref}
      style={style}
      className={clsx("group relative block", dragOverlay && "scale-[1.02]")}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <motion.article
        layout
        className={clsx(
          "card-surface border-l-4 p-3 transition hover:-translate-y-0.5",
          urgencyStyles[task.urgency],
          isSelected && "ring-2 ring-slate-200",
          isDragging && "ring-2 ring-slate-900 ring-offset-2",
          isDropTarget && "outline outline-2 outline-offset-2 outline-slate-900",
          dragOverlay && "shadow-xl ring-2 ring-slate-900 ring-offset-2"
        )}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label={`Reorder ${task.title}`}
            data-dnd-handle
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            {...(handleProps ?? {})}
          >
            <span aria-hidden className="text-lg leading-none">⋮⋮</span>
          </button>

          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  data-no-dnd
                  className="mt-0.5 h-4 w-4 rounded border border-slate-300 bg-white text-slate-900 shadow-sm accent-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                  checked={isSelected}
                  onChange={onToggle}
                  onPointerDown={handlePointerStop}
                  aria-label={`Select task ${task.title}`}
                />
                <div>
                  <h3 className={clsx("text-sm font-semibold leading-tight", task.urgency === "high" && "text-red-600")}>
                    {task.title}
                  </h3>
                  {task.notes ? (
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2 whitespace-pre-line">{task.notes}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <span className="hidden text-slate-600 sm:inline">Drag to reorder</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
              <span>{task.urgency === "high" ? "🔥 This Week" : task.urgency === "medium" ? "Next" : "Later"}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-no-dnd
                  onPointerDown={handlePointerStop}
                  onClick={handleViewDetails}
                  className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  View details
                </button>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                  {listTitle}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.article>
    </motion.div>
  );
});

export function BoardView({ tasklists }: BoardViewProps) {
  const [tasklistsState, setTasklistsState] = useState<TaskListWithTasks[]>(tasklists);
  const [visibleListIds, setVisibleListIds] = useState<string[]>(() => tasklists.map((list) => list.id));
  const [activeList, setActiveList] = useState<string>(tasklists[0]?.id ?? "");
  const [selectedTaskIds, setSelectedTaskIds] = useState<SelectionState>(new Set());
  const [destinationListId, setDestinationListId] = useState<string>("");
  const [detailTask, setDetailTask] = useState<{ task: Task; listTitle: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isActionPending, startActionTransition] = useTransition();
  const [activeDragTask, setActiveDragTask] = useState<ActiveDragTask>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    })
  );

  useEffect(() => {
    setTasklistsState(tasklists);
  }, [tasklists]);

  useEffect(() => {
    const fallback = tasklistsState.map((list) => list.id);
    setVisibleListIds((current) => {
      if (current.length === 0) return fallback;
      const stillVisible = current.filter((id) => tasklistsState.some((list) => list.id === id));
      return stillVisible.length > 0 ? stillVisible : fallback;
    });
  }, [tasklistsState]);

  useEffect(() => {
    const firstVisible = visibleListIds.find((id) => tasklistsState.some((list) => list.id === id));
    if (firstVisible) {
      setActiveList(firstVisible);
    }
  }, [visibleListIds, tasklistsState]);

  useEffect(() => {
    if (!activeDragTask) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeDragTask]);

  useEffect(() => {
    const selectionListIds = Array.from(selectedTaskIds).map((key) => key.split(":")[0]);
    const uniqueListIds = Array.from(new Set(selectionListIds));
    const firstDifferentList = tasklistsState.find((list) => list.id !== uniqueListIds[0]);
    if (!destinationListId && firstDifferentList) {
      setDestinationListId(firstDifferentList.id);
    }
    if (destinationListId && selectionListIds.length > 0 && uniqueListIds.includes(destinationListId)) {
      const alternative = tasklistsState.find((list) => list.id !== uniqueListIds[0]);
      if (alternative) setDestinationListId(alternative.id);
    }
  }, [destinationListId, selectedTaskIds, tasklistsState]);

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
      tasklistsState
        .map((list) => ({
          key: list.id,
          label: list.title,
          isDefault: list.isDefault,
          tasks: [...(list.tasks ?? [])]
        }))
        .filter((column) => visibleListIds.includes(column.key)),
    [tasklistsState, visibleListIds]
  );

  const selectedTasks = useMemo(
    () =>
      tasklistsState
        .flatMap((list) => (list.tasks ?? []).map((task) => ({ ...task, listId: list.id })))
        .filter((task) => selectedTaskIds.has(`${task.listId}:${task.id}`)),
    [selectedTaskIds, tasklistsState]
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

  const openTaskDetails = (task: Task, listTitle: string) => setDetailTask({ task, listTitle });
  const closeTaskDetails = () => setDetailTask(null);

  const clearSelection = () => setSelectedTaskIds(new Set());

  const focusTasks = useMemo(
    () =>
      tasklistsState
        .flatMap((list) => (list.tasks ?? []).map((task) => ({ ...task, listTitle: list.title })))
        .filter((task) => task.status !== "completed" && task.title.includes("🔥")),
    [tasklistsState]
  );

  const toSortableId = (view: ViewKey, listId: string, taskId: string) => `${view}:${listId}:${taskId}`;

  const handleDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current as SortableTaskMeta | undefined;
    if (!data) return;
    const listTitle = tasklistsState.find((list) => list.id === data.listId)?.title ?? "";
    setActiveDragTask({ task: data.task, listId: data.listId, listTitle });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) {
      setActiveDragTask(null);
      return;
    }

    const activeData = active.data.current as SortableTaskMeta | undefined;
    const overData = over.data.current as SortableTaskMeta | undefined;

    if (!activeData || !overData || activeData.listId !== overData.listId) {
      setActiveDragTask(null);
      return;
    }

    if (active.id !== over.id) {
      const listId = activeData.listId;
      let previousTaskId: string | undefined;
      let shouldPersist = false;
      let rollbackState: TaskListWithTasks[] | null = null;

      setTasklistsState((current) => {
        rollbackState = current.map((list) => ({ ...list, tasks: [...(list.tasks ?? [])] }));

        return current.map((list) => {
          if (list.id !== listId) return list;
          const tasks = list.tasks ?? [];
          const oldIndex = tasks.findIndex((task) => task.id === activeData.task.id);
          const newIndex = tasks.findIndex((task) => task.id === overData.task.id);
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return list;
          const reordered = arrayMove(tasks, oldIndex, newIndex);
          previousTaskId = reordered[newIndex - 1]?.id;
          shouldPersist = true;
          return { ...list, tasks: reordered };
        });
      });

      if (shouldPersist) {
        const safeRollback = rollbackState;
        startActionTransition(() => {
          reorderTask(listId, activeData.task.id, previousTaskId).catch((error) => {
            console.error("Failed to reorder task", error);
            if (safeRollback) setTasklistsState(safeRollback);
          });
        });
      }
    }

    setActiveDragTask(null);
  };

  const handleDragCancel = () => setActiveDragTask(null);

  const SortableTaskCard = ({
    view,
    task,
    listId,
    listTitle,
    isSelected,
    onToggle,
    onViewDetails
  }: {
    view: ViewKey;
    task: Task;
    listId: string;
    listTitle: string;
    isSelected: boolean;
    onToggle: () => void;
    onViewDetails: () => void;
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
      id: toSortableId(view, listId, task.id),
      data: { task, listId },
      disabled: isActionPending
    });

    const style: CSSProperties = {
      transform: transform ? CSS.Transform.toString(transform) : undefined,
      transition
    };

    const shouldShowDropIndicator = isOver && !isDragging;

    return (
      <div className="flex flex-col gap-2">
        {shouldShowDropIndicator ? (
          <motion.div
            layout
            className="h-12 rounded-md border-2 border-dashed border-slate-300 bg-white shadow-[inset_0_1px_0_rgba(0,0,0,0.04)]"
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            aria-hidden
          />
        ) : null}
        <TaskCard
          ref={setNodeRef}
          task={task}
          listTitle={listTitle}
          isSelected={isSelected}
          isDragging={isDragging}
          isDropTarget={shouldShowDropIndicator}
          onToggle={onToggle}
          onViewDetails={onViewDetails}
          handleProps={{ ...attributes, ...listeners }}
          style={style}
        />
      </div>
    );
  };

  const handleClearCompleted = (tasklistId: string) => {
    startActionTransition(async () => {
      await clearCompletedInList(tasklistId);
    });
  };

  const handleTriageDefault = (tasklistId: string) => {
    if (!tasklistId) return;
    startActionTransition(async () => {
      await syncDefaultList();
    });
  };

  const hasColumns = columns.length > 0;
  const activeColumn = useMemo(
    () => columns.find((column) => column.key === activeList),
    [activeList, columns]
  );
  const activeListLabel = columns.find((column) => column.key === activeList)?.label ?? "";

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="card-surface border-slate-200 bg-slate-950 px-4 py-3 text-white shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Focus Mode</p>
            <h2 className="text-xl font-semibold">High-Urgency Tasks</h2>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
            {focusTasks.length} on fire
          </span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          <AnimatePresence initial={false}>
            {focusTasks.length > 0 ? (
              focusTasks.map((task) => (
                <motion.div
                  key={`${task.listId}:${task.id}`}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="min-w-[240px] rounded-lg bg-white/5 p-3 shadow-inner backdrop-blur"
                >
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-300">{task.listTitle}</p>
                  <p className="mt-1 text-sm font-semibold leading-tight">{task.title}</p>
                  {task.due ? (
                    <p className="mt-1 text-[11px] text-amber-200">
                      Due: {new Date(task.due).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  ) : null}
                </motion.div>
              ))
            ) : (
              <div className="text-sm text-slate-200">No 🔥 tasks right now. Add one to spotlight it.</div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tasklistsState.map((list) => (
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
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
        >
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
                  Moving from <strong>{tasklistsState.find((list) => list.id === singleSourceListId)?.title}</strong>
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
                {tasklistsState
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
              <div key={`desktop-${column.key}`} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">{column.label}</h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleClearCompleted(column.key)}
                      disabled={isActionPending}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Clear Completed
                    </button>
                    {column.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleTriageDefault(column.key)}
                        disabled={isActionPending}
                        className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isActionPending ? "Triaging..." : "Triage Inbox"}
                      </button>
                    ) : null}
                    <span className="text-xs text-slate-500">{column.tasks.length} tasks</span>
                  </div>
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
                  <SortableContext
                    items={column.tasks.map((task) => toSortableId("desktop", column.key, task.id))}
                    strategy={verticalListSortingStrategy}
                  >
                    {column.tasks.map((task) => (
                      <SortableTaskCard
                        key={toSortableId("desktop", column.key, task.id)}
                        view="desktop"
                        task={task}
                        listId={column.key}
                        listTitle={column.label}
                        isSelected={selectedTaskIds.has(`${column.key}:${task.id}`)}
                        onToggle={() => handleToggleTask(column.key, task.id)}
                        onViewDetails={() => openTaskDetails(task, column.label)}
                      />
                    ))}
                  </SortableContext>
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
              {activeColumn ? (
                <>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <button
                      type="button"
                      onClick={() => handleClearCompleted(activeColumn.key)}
                      disabled={isActionPending}
                      className="rounded-lg border border-slate-300 px-3 py-1 font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Clear Completed
                    </button>
                    {activeColumn.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleTriageDefault(activeList)}
                        disabled={isActionPending}
                        className="rounded-lg bg-slate-900 px-3 py-1 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isActionPending ? "Triaging..." : "Triage Inbox"}
                      </button>
                    ) : null}
                  </div>
                  <SortableContext
                    items={activeColumn.tasks.map((task) => toSortableId("mobile", activeColumn.key, task.id))}
                    strategy={verticalListSortingStrategy}
                  >
                    {activeColumn.tasks.map((task) => (
                      <SortableTaskCard
                        key={toSortableId("mobile", activeColumn.key, task.id)}
                        view="mobile"
                        task={task}
                        listId={activeColumn.key}
                        listTitle={activeListLabel}
                        isSelected={selectedTaskIds.has(`${activeList}:${task.id}`)}
                        onToggle={() => handleToggleTask(activeList, task.id)}
                        onViewDetails={() => openTaskDetails(task, activeListLabel)}
                      />
                    ))}
                  </SortableContext>
                </>
              ) : null}
            </div>
          </div>

          <DragOverlay>
            {activeDragTask ? (
              <TaskCard
                task={activeDragTask.task}
                listTitle={activeDragTask.listTitle}
                isSelected={selectedTaskIds.has(`${activeDragTask.listId}:${activeDragTask.task.id}`)}
                dragOverlay
                onToggle={() => handleToggleTask(activeDragTask.listId, activeDragTask.task.id)}
                onViewDetails={() => openTaskDetails(activeDragTask.task, activeDragTask.listTitle)}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <p className="text-sm text-slate-600">No lists selected. Choose at least one list to view tasks.</p>
      )}

      {detailTask ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 overflow-y-auto"
          onClick={closeTaskDetails}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Task details for ${detailTask.task.title}`}
            className="card-surface relative w-full max-w-xl border-slate-200 p-5 shadow-lg max-h-[80vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeTaskDetails}
              className="absolute right-3 top-3 rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Close
            </button>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Task Details</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">{detailTask.task.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
              <span className="rounded-full bg-slate-100 px-2 py-1">List: {detailTask.listTitle}</span>
              <span
                className={clsx(
                  "rounded-full px-2 py-1",
                  detailTask.task.urgency === "high"
                    ? "bg-red-100 text-red-700"
                    : detailTask.task.urgency === "medium"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-700"
                )}
              >
                {detailTask.task.urgency} priority
              </span>
              <span
                className={clsx(
                  "rounded-full px-2 py-1",
                  detailTask.task.status === "completed"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-blue-100 text-blue-700"
                )}
              >
                {detailTask.task.status === "completed" ? "Completed" : "Active"}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Due</dt>
                <dd className="font-medium">
                  {detailTask.task.due ? new Date(detailTask.task.due).toLocaleString() : "No due date"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Updated</dt>
                <dd className="font-medium">
                  {detailTask.task.updated ? new Date(detailTask.task.updated).toLocaleString() : "Unknown"}
                </dd>
              </div>
            </dl>
            {detailTask.task.notes ? (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-semibold text-slate-900">Notes</h4>
                <p className="text-sm text-slate-700 whitespace-pre-line">{detailTask.task.notes}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
