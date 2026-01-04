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
   - List IDs for Family, Home Improvement, Home Maintenance, Square
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
- **UI**: `components/board/BoardView.tsx`, `components/QuickAddBar.tsx`, and `components/SyncControls.tsx` provide the urgency Kanban, quick-add bar, and action buttons. `app/page.tsx` wires them together with sample data for local preview.

## Notes
- Server actions require an authenticated session; unauthenticated requests will throw.
- The sample page uses mock data until you wire in `fetchTasksByList` for live tasks.
