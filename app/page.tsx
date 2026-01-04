import { QuickAddBar } from "@/components/QuickAddBar";
import { BoardView } from "@/components/board/BoardView";
import { SyncControls } from "@/components/SyncControls";
import { TaskSnapshot } from "@/components/TaskSnapshot";
import { sampleTasks } from "@/lib/tasks/sampleData";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ConnectGooglePrompt } from "@/components/ConnectGooglePrompt";
import { fetchDefaultTaskSnapshot, fetchTasklistsWithTasks } from "@/app/actions/syncEngine";
import { listRoutingCatalog } from "@/lib/tasks/schema";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const tasksByList = session
    ? await fetchTasklistsWithTasks()
    : listRoutingCatalog.map((rule) => ({
        id: rule.tasklistId ?? rule.key,
        title: rule.label,
        tasks: sampleTasks[rule.key] ?? []
      }));
  const snapshot = session ? await fetchDefaultTaskSnapshot() : null;

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
        {session && <SyncControls />}
      </header>

      {session ? (
        <>
          <QuickAddBar />
          {snapshot ? <TaskSnapshot tasks={snapshot.tasks} error={snapshot.error} /> : null}
          <BoardView tasklists={tasksByList} />
        </>
      ) : (
        <ConnectGooglePrompt />
      )}
    </main>
  );
}
