# TaskPulse (HL Google Tasks Board)

TaskPulse is a Next.js (App Router) dashboard that triages tasks created in the Google Tasks **Default** list (e.g., via Gemini) and routes them to the correct project lists with urgency metadata. It also visualizes tasks on a mobile-friendly Kanban organized by target list and urgency.

## Tech Stack
- Next.js 14 (App Router)
- NextAuth.js with Google provider (Tasks scope)
- Tailwind CSS + shadcn/ui tokens
- googleapis (Tasks API)
- Zod for parsing schemas

## Quickstart
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in:
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   - `NEXTAUTH_SECRET`
   - `DEFAULT_TASKLIST_ID` (usually `@default`)
   - `FAMILY_TASKLIST_ID`, `HOME_IMPROVEMENT_TASKLIST_ID`, `HOME_MAINTENANCE_TASKLIST_ID`, `SQUARE_TASKLIST_ID`
3. Run the dev server:
   ```bash
   npm run dev
   ```

## Core Pieces
- **Task schema & parsing**: `lib/tasks/schema.ts` and `lib/tasks/parser.ts` define task typing, urgency levels, and routing keywords.
- **Auth**: `lib/auth.ts` and `app/api/auth/[...nextauth]/route.ts` configure Google OAuth with Tasks scope and JWT refresh.
- **Sync Engine**: `app/actions/syncEngine.ts` implements server actions to:
  - Inspect Default list tasks and move them to matched lists with metadata.
  - Bulk-archive completed tasks across lists.
  - Quick add tasks to a chosen list.
  - Fetch all Google Task lists plus their tasks for the dashboard.
- **UI**: `components/board/BoardView.tsx`, `components/QuickAddBar.tsx`, and `components/SyncControls.tsx` provide the urgency Kanban, quick-add bar, and action buttons. `app/page.tsx` wires them together, using live tasks when signed in and sample data when not.

## Notes
- Server actions require an authenticated session; unauthenticated requests will throw.
- Signed-in sessions load your Google Task lists via `fetchTasklistsWithTasks`, while signed-out sessions fall back to mock data.
