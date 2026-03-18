# Meeting Agenda App

A full-stack meeting agenda management application built with React, Fastify, and Supabase.

**Features:**
- Auth (email/password via Supabase Auth)
- Meeting template library (create, edit, duplicate, export/import JSON)
- Meeting lifecycle: PLANNED → IN_PROGRESS → COMPLETED
- Live meeting view with per-item countdown timers, chimes, notes
- Meeting schedule (upcoming) and archive (completed) views
- Actual vs planned time comparison in archive

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Fastify + TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Hosting | Vercel-ready |

---

## Project Structure

```
meeting-agenda-app/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── components/    # AgendaEditor, Layout, ProtectedRoute
│   │   ├── contexts/      # AuthContext
│   │   ├── lib/           # supabase.ts, api.ts
│   │   ├── pages/         # All route pages
│   │   └── types/         # Shared TypeScript types
│   ├── .env.example
│   └── package.json
├── backend/           # Fastify API
│   ├── src/
│   │   ├── lib/           # supabase.ts
│   │   ├── middleware/    # auth.ts
│   │   ├── routes/        # templates.ts, meetings.ts
│   │   └── types/         # index.ts
│   ├── .env.example
│   └── package.json
├── api/
│   └── index.ts       # Vercel serverless entry point
├── supabase/
│   └── migrations/
│       └── 001_init.sql
└── vercel.json
```

---

## Setup Instructions

### 1. Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Once the project is ready, go to **SQL Editor** and run the migration:
   ```
   supabase/migrations/001_init.sql
   ```
   Paste the entire file contents and execute.
3. In **Project Settings → API**, copy:
   - **Project URL** → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret, backend only)
4. In **Authentication → Settings**, optionally disable email confirmation for development.

---

### 2. Environment Variables

**Frontend** — copy `frontend/.env.example` to `frontend/.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3001
```

**Backend** — copy `backend/.env.example` to `backend/.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3001
FRONTEND_URL=http://localhost:5173
```

---

### 3. Run Locally

Install dependencies and start both servers:

```bash
# Backend
cd backend
npm install
npm run dev
# → Running on http://localhost:3001

# Frontend (in a new terminal)
cd frontend
npm install
npm run dev
# → Running on http://localhost:5173
```

The frontend Vite dev server proxies `/api/*` requests to the backend automatically.

---

### 4. Deploy to Vercel

#### Prerequisites
- Vercel account
- Vercel CLI: `npm i -g vercel`

#### Steps

1. **Set environment variables** in Vercel dashboard (or via CLI):
   ```bash
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add FRONTEND_URL   # set to your Vercel domain, e.g. https://your-app.vercel.app
   ```

2. **Deploy:**
   ```bash
   vercel --prod
   ```

The `vercel.json` at the project root configures:
- Frontend build: `cd frontend && npm run build` → `frontend/dist`
- API: `/api/*` → serverless function at `api/index.ts`
- SPA routing: all other paths → `index.html`

> **Note:** For production, install backend dependencies at the root by adding a root `package.json` or using Vercel's build settings to install from both `frontend/` and `backend/`.

#### Alternative: Separate Deployments

You can also deploy frontend and backend separately:
- **Frontend**: Deploy `frontend/` to Vercel as a static site (set `VITE_API_URL` to your backend URL)
- **Backend**: Deploy to Railway, Render, or any Node.js host

---

## API Reference

All endpoints require `Authorization: Bearer <supabase-access-token>` header.

### Templates
| Method | Path | Description |
|---|---|---|
| GET | `/api/templates` | List all templates |
| GET | `/api/templates/:id` | Get template with items |
| POST | `/api/templates` | Create template |
| PUT | `/api/templates/:id` | Update template (replaces items) |
| DELETE | `/api/templates/:id` | Delete template |
| POST | `/api/templates/:id/duplicate` | Duplicate template |

### Meetings
| Method | Path | Description |
|---|---|---|
| GET | `/api/meetings` | List all meetings |
| GET | `/api/meetings/upcoming` | Upcoming (PLANNED/IN_PROGRESS) |
| GET | `/api/meetings/archive` | Completed meetings |
| GET | `/api/meetings/:id` | Get meeting with items |
| POST | `/api/meetings` | Create meeting |
| PUT | `/api/meetings/:id` | Update meeting |
| PATCH | `/api/meetings/:id/items/:itemId` | Update single item (live tracking) |
| DELETE | `/api/meetings/:id` | Delete meeting |

### Profile
| Method | Path | Description |
|---|---|---|
| GET | `/api/profile` | Get current user profile |
| PUT | `/api/profile` | Update name |

---

## Meeting Format Types

Inherited from the original CET Meeting Agenda app:

| Code | Label | Color |
|---|---|---|
| FIP | For Info — Presentation | Teal |
| FI | For Info — Pre-read | Gray |
| P+D | Presentation + Decision | Red |
| D | Decision (Pre-read) | Orange |
| WND | Workshop — No Decision | Purple |
| W+D | Workshop + Decision | Light Purple |
| PR | Prayer / Devotion | Navy |
| O | Other | Green |
| BRK | Break | Light Gray |

---

## Development Notes

- The live meeting view (`/meetings/:id/live`) saves tracking state to Supabase in real-time so the state persists across page refreshes.
- Countdown timers are per-item and count down from planned duration. When time runs out, the timer goes red and shows overtime (negative).
- Audio chimes fire at 10, 5, 1, and 0 minutes remaining. A louder chime plays at 0.
- The agenda editor supports drag-and-drop reordering using `@hello-pangea/dnd`.
- Templates can be exported as JSON and re-imported on the Templates page.
