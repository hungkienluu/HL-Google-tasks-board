import clsx from "clsx";
import type { TaskSnapshot } from "@/app/actions/syncEngine";

type TaskSnapshotProps = {
  tasks: TaskSnapshot[];
  error?: string;
};

export function TaskSnapshot({ tasks, error }: TaskSnapshotProps) {
  const hasTasks = tasks.length > 0;

  return (
    <section className="card-surface border-slate-200 p-4 shadow-none">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Google Tasks</p>
          <h2 className="text-lg font-semibold text-slate-900">Default list snapshot</h2>
        </div>
        <span className="text-xs text-slate-500">{tasks.length} shown</span>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      ) : hasTasks ? (
        <ul className="mt-3 divide-y divide-slate-200">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-col gap-1 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{task.title}</p>
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                    task.status === "completed"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-blue-100 text-blue-700"
                  )}
                >
                  {task.status === "completed" ? "Done" : "Active"}
                </span>
              </div>
              {task.notes ? <p className="text-xs text-slate-600 line-clamp-2">{task.notes}</p> : null}
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Updated: {task.updated ? new Date(task.updated).toLocaleString() : "Unknown"}
                {task.due ? ` · Due: ${new Date(task.due).toLocaleDateString()}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No tasks found in your default list.</p>
      )}
    </section>
  );
}
