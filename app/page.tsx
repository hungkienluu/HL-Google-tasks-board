import { QuickAddBar } from "@/components/QuickAddBar";
import { BoardView } from "@/components/board/BoardView";
import { SyncControls } from "@/components/SyncControls";
import { sampleTasks } from "@/lib/tasks/sampleData";

export default async function HomePage() {
  // In production, fetch tasks from Google Tasks via fetchTasksByList server action.
  const tasksByList = sampleTasks;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">TaskPulse</p>
          <h1 className="text-3xl font-bold text-slate-900">Urgency Dashboard</h1>
          <p className="text-sm text-slate-600">
            AI triage engine for Gemini-created Google Tasks. Sync, route, and visualize in one place.
          </p>
        </div>
        <SyncControls />
      </header>

      <QuickAddBar />
      <BoardView tasksByList={tasksByList} />
    </main>
  );
}
