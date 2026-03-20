# UAT Log — Workshop Agenda App
**Date:** 2026-03-20
**Agent:** Claude Code UAT

## Issues Found

| # | Severity | Area | Description | Status |
|---|----------|------|-------------|--------|
| 1 | P0 Critical | Auth/DB | `test-user` string used as user ID — invalid UUID causes Supabase insert errors on templates, meetings, profile | Fixed |
| 2 | P0 Critical | DB Schema | `organisation`, `alarms_enabled`, `alarm_minutes_before`, `alarm_type` columns missing from `meetings` table — meeting creation fails with unknown column error | Fixed (migration added) |
| 3 | P1 High | Excel Parser | `excelParser.ts` outputs invalid format codes (`R`, `A`, `I`, `WS`, `P`, `Q`) not in the DB `meeting_format` enum — imported agenda items fail to insert | Fixed |
| 4 | P1 High | Backend API | POST/PUT `/api/meetings` routes don't handle `organisation` or alarm fields — data silently dropped on create/update via backend | Fixed |
| 5 | P2 Medium | Meetings Page | `meeting.participants.length` crashes if `participants` is null (DB allows null) | Fixed |
| 6 | P2 Medium | Edit Meeting | `existingMeeting.participants.join()` crashes if participants is null when editing a meeting | Fixed |
| 7 | P2 Medium | Auth/RLS | Frontend calls Supabase directly with anon key + no auth session — RLS policies block all operations when enabled | Known limitation (see notes) |

## Fixes Applied

### Fix 1: UUID Issue (P0)
**Files changed:**
- `frontend/src/contexts/AuthContext.tsx` — Changed mock user `id` from `'test-user'` to `'00000000-0000-0000-0000-000000000001'`
- `frontend/src/lib/api.ts` — Changed `TEST_USER_ID` fallback from `'test-user'` to `'00000000-0000-0000-0000-000000000001'`

**Why:** Supabase expects valid UUIDs for all `uuid` type columns. The string `'test-user'` causes `invalid input syntax for type uuid` errors on every database write.

### Fix 2: Missing DB Columns (P0)
**Files added:**
- `supabase/migrations/002_add_meeting_fields.sql` — Adds `organisation`, `alarms_enabled`, `alarm_minutes_before`, `alarm_type` columns to `meetings` table

**Why:** The frontend and backend code reference these fields (NewMeetingPage has Organisation input, alarm settings UI), but the initial migration `001_init.sql` doesn't include them. Supabase PostgREST returns an error when inserting/updating with unknown columns.

**Action required:** Run this migration on the Supabase project:
```bash
supabase db push
# or manually via Supabase SQL Editor
```

### Fix 3: Excel Parser Format Codes (P1)
**Files changed:**
- `frontend/src/lib/excelParser.ts` — Updated `VALID_FORMATS` array and `normalizeFormat()` function to output only valid `meeting_format` enum values (`FIP`, `FI`, `P+D`, `D`, `WND`, `W+D`, `PR`, `O`, `BRK`)

**Why:** The parser was outputting codes like `R`, `A`, `I`, `WS`, `P`, `Q` which are not in the PostgreSQL `meeting_format` enum. Importing an Excel agenda with these formats would cause a DB insert error.

### Fix 4: Backend Missing Fields (P1)
**Files changed:**
- `backend/src/routes/meetings.ts` — Added `organisation`, `alarms_enabled`, `alarm_minutes_before`, `alarm_type` to both POST (create) and PUT (update) meeting routes

**Why:** Even though the frontend currently calls Supabase directly, the backend API routes should handle all meeting fields for correctness and future API use.

### Fix 5 & 6: Null Safety on Participants (P2)
**Files changed:**
- `frontend/src/pages/MeetingsPage.tsx` — Added optional chaining `meeting.participants?.length`
- `frontend/src/pages/NewMeetingPage.tsx` — Added fallback `(existingMeeting.participants || []).join(', ')`

**Why:** The `participants` column in the DB allows null values (no `NOT NULL` constraint). If a meeting has null participants, accessing `.length` or `.join()` throws a runtime TypeError.

## Passed Checks

### Templates
- [x] Template list page renders correctly
- [x] Create new template flow (TemplateEditorPage)
- [x] Edit existing template flow
- [x] Delete template (with confirmation dialog)
- [x] Export template as JSON
- [x] Import template from JSON
- [x] Export template as XLSX
- [x] Download blank XLSX template
- [x] Duplicate template
- [x] AgendaEditor drag-and-drop reordering
- [x] AgendaEditor session editing modal
- [x] Excel/CSV file import via drag-and-drop

### Meetings
- [x] Meetings list page with tabs (Upcoming / Archive)
- [x] Create new meeting form
- [x] Edit meeting flow
- [x] Delete meeting (with confirmation)
- [x] Template selector on new meeting
- [x] Meeting detail page

### Live Meeting (Track View)
- [x] Summary / Detail / Track / Edit view modes
- [x] Timer countdown logic (GiantTimer, TimerDisplay)
- [x] Start/end session tracking with Supabase persistence
- [x] Manual time entry for sessions
- [x] Progress bar updates
- [x] Keyboard shortcuts (Space, M, F, D, Esc)
- [x] Dark mode toggle with localStorage persistence
- [x] Presenter/fullscreen mode
- [x] Chime functionality (Web Audio synthesis — bell, bowl, ping, chord, silent)
- [x] Session notes input with live save
- [x] Completion modal with final notes
- [x] Projected times / drift calculation
- [x] Format legend toggle
- [x] Lock mode (hides edit tab)
- [x] Brand import modal
- [x] Excel export of agenda
- [x] File import in edit mode

### General
- [x] Navigation between all pages (React Router)
- [x] Dashboard with stats cards and upcoming/archive lists
- [x] Settings page (chime selection, brand import)
- [x] Responsive layout (sidebar navigation)
- [x] No hardcoded localhost URLs in production code (all env-driven)
- [x] Error handling on all Supabase calls (error → throw pattern)
- [x] React Query caching and invalidation
- [x] 404/catch-all redirect to dashboard

## Remaining Issues / Recommendations

### Issue 7: RLS + Stubbed Auth (P2 — Known Limitation)
The frontend calls Supabase directly using the anon key with no authenticated session. Row Level Security policies require `auth.uid()` to match, which returns null with the stub. **The app only works if RLS is disabled on the Supabase project.** This is expected per the commit message "auth deferred to backlog".

**Recommendation:** When implementing real auth:
1. Either route all frontend calls through the backend (which uses the service role key)
2. Or implement proper Supabase auth so the anon key client has a valid session

### Other Recommendations
- **Participants column:** Consider adding `NOT NULL DEFAULT '{}'` constraint to prevent null values
- **Backend API:** The frontend currently bypasses the backend entirely — consider unifying to use one path
- **Error boundaries:** No React error boundary component exists — unhandled errors will white-screen the app
- **Migration deployment:** Migration `002_add_meeting_fields.sql` must be run on the Supabase project before the new code deploys
