# JCI Collarint — Skill-Based Mentoring Platform

MVP of the **JCI (Junior Chamber International)** platform that connects experienced members (mentors) with those seeking professional development (mentees), featuring **semantic skill matching** and an **AI Coach** that supports the mentee between sessions.

## Feature highlights

| Module | What it does |
|---|---|
| Onboarding | Email sign-up/login + 3-step wizard (teach / learn / goal + availability) |
| Semantic matching | Top 5 mentors by cosine similarity between embeddings, % score, shared skills and an AI-written explanation |
| Mentorship flow | Request → notification → accept/decline → AI-generated 4-session plan → scheduling → session logging |
| AI Coach | **Real-time streamed chat** with full mentorship context, suggestion chips on the empty state, task creation **and completion** from natural language, "New conversation" (archives the current thread, keeps the mentorship context) and a "Prepare next session" button (agenda + 5 questions, with copy) |
| Tasks | Created by the mentee or by the Coach (with due dates); check off from the list or by telling the Coach; delete with one click |
| Mentor panel | Invites, active mentorships, upcoming sessions and the mentee's preparation view |
| Admin dashboard | Skills heatmap (abundant/scarce) + program metrics |

## Stack

- **Next.js 16 (App Router) + TypeScript** (single-route SPA + API routes)
- **Tailwind CSS 4 + shadcn/ui** (identity: navy `#0A1F44`, gold `#D4A843`)
- **Prisma + SQLite** (local demo) — Postgres/Supabase schema ready in `supabase/schema.sql`
- **OpenAI** (`gpt-4o-mini` + `text-embedding-3-small`) **with automatic fallback**: without an API key, the chat uses the environment's AI SDK and matching uses local lexical analysis — the demo **never breaks**

## Setup in 5 steps

```bash
# 1. Install dependencies
bun install

# 2. Set environment variables (optional to plug in keys)
cp .env.example .env
#   → OPENAI_API_KEY (optional): enables gpt-4o-mini + text-embedding-3-small
#   → AUTH_SECRET (recommended): HMAC key for the session cookie
#   → without a key, fallback mode is used automatically

# 3. Create the local database schema
bun run db:push

# 4. Seed the demo data (12 members + 2 active mentorships)
bun scripts/seed.ts

# 5. Run
bun run dev
#    → open http://localhost:3000
```

### Demo accounts (password: `demo1234`)

| Account | Role in the demo |
|---|---|
| `lucas@demo.jci` | Mentee with an active mentorship (Marcos), plan, tasks and coach history |
| `marcos@demo.jci` | Mentor of the active mentorship with Lucas |
| `carlos@demo.jci` | Mentor with a **pending invite** from Rafael (test accept/decline) |
| `patricia@demo.jci` | Mentee of the 2nd active mentorship (Marina) |
| `admin@jci.org.br` | Access to the admin dashboard |

The login screen has **quick access** buttons for all of them.

## Full demo flow (acceptance criteria)

1. **Sign in** with `lucas@demo.jci` (quick access)
2. **Onboarding** (new user): the 3-step wizard generates the profile's embeddings
3. **Matches**: `/Matches` shows the top 5 with % score and AI explanation
4. **Request mentorship**: button on the card → invite message
5. **Accept**: sign in with `carlos@demo.jci` → notification bell → Mentor panel → **Accept** (the 4-session plan is generated automatically)
6. **AI Coach**: go back to the mentee → chat streams in real time with real context (goal, plan, sessions, tasks) → the Coach creates tasks with due dates and checks off finished ones when you tell it (e.g. "I finished the pitch!")
7. **Prepare next session**: generates agenda + 5 questions → copy button → the mentor sees the preparation in their panel
8. **Session**: mentor schedules, logs "what was discussed" + "commitments" and completes
9. **New conversation**: click the ✎ button on the Coach header to archive the thread and start fresh — the Coach still knows the goal, plan and tasks
10. **Admin**: sign in with `admin@jci.org.br` → skills heatmap + metrics

## The AI Coach

- **Streaming replies**: the answer renders token by token (SSE), both in OpenAI mode (`stream: true`) and in fallback mode (simulated pace), so the demo always feels alive.
- **Never generic**: every reply injects a dossier with the mentee's goal, the 4-session plan, logged sessions + commitments, pending/completed tasks, and the recent conversation. Replies must end with a concrete action.
- **Task actions from chat**: after replying, a dedicated JSON extraction call decides which tasks to create (max 2, with due dates and anti-garbage guards) and which pending tasks the mentee just reported finishing (fuzzy title match, accent/punctuation-insensitive). The UI toasts "Task created" / "Task completed" and the list refreshes.
- **New conversation**: one click archives the current messages (kept in the database with `archivedAt`) and resets the chat to the empty state with suggestion chips. The mentorship dossier stays in the prompt, so the Coach keeps its memory of the program — only the small talk resets.
- **Three reliability layers**: OpenAI → environment SDK → data-driven contingency reply built from the real mentorship data.

## Security (audited)

| Layer | Implementation |
|---|---|
| Passwords | scrypt + 16-byte random salt, `timingSafeEqual` comparison |
| Session | HMAC-SHA256 signed token with 7-day expiry, httpOnly cookie (`SameSite=None; Secure` behind the HTTPS proxy, `Lax` on local http) + `x-session-token` header fallback for iframe previews |
| Authorization | Every API route resolves the user first; mentorship resources are gated by **participant** check; `respond` = mentor only; scheduling = mentor only; session prep = mentee only; admin stats = `isAdmin` |
| CSRF | `src/proxy.ts` (Next 16 proxy convention) rejects any POST/PATCH/PUT/DELETE whose `Origin` host differs from the deployment host — blocks cross-site form attacks (incl. `text/plain` forms) without breaking the iframe preview |
| Rate limiting | In-memory sliding windows: login 10/min per email+IP, register 10/min per IP, Coach 30/5min per user, session prep 10/5min per user |
| Input validation | Length caps on every field (messages 2000, task titles 160, notes 3000, goal 600, invite 1000, email 120), whitelists for enums (availability, actions), date parsing guards |
| Error hygiene | Internal errors are logged server-side only; the client receives a generic 500 message (no stack/Prisma leakage) |
| XSS | React escapes all user content; the Coach markdown renders through `react-markdown` (raw HTML disabled by default, URL scheme sanitization built in); no `dangerouslySetInnerHTML` on app code |
| Headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo off). `X-Frame-Options` intentionally absent — the platform is designed to embed in preview iframes |
| Secrets | `.env*` git-ignored; `.env.example` documents every variable; the dev fallback for `AUTH_SECRET` logs a one-time warning when unset |

## API reference

All routes are JSON, authenticated via cookie or `x-session-token` header.

| Method & route | Access | Purpose |
|---|---|---|
| `POST /api/auth/register` | public | Create account (auto sign-in) |
| `POST /api/auth/login` | public | Sign in (rate limited) |
| `POST /api/auth/logout` | public | Clear session cookie |
| `GET /api/auth/me` | session | Current profile |
| `PUT /api/profile` | session | Save onboarding (computes embeddings) |
| `GET /api/matches` | onboarded | Top 5 mentors + scores + AI reasons |
| `GET /api/mentorships` | session | My mentorships (as mentee / as mentor) |
| `POST /api/mentorships` | session | Propose mentorship (duplicate guard) |
| `GET /api/mentorships/[id]` | participants (+admin) | Full mentorship detail |
| `POST /api/mentorships/[id]/respond` | mentor | Accept (generates 4-session plan) / decline |
| `POST /api/mentorships/[id]/sessions` | participants | `schedule` (mentor) · `record` · `complete` |
| `GET /api/mentorships/[id]/tasks` | participants | List tasks |
| `POST /api/mentorships/[id]/tasks` | participants | Create manual task |
| `PATCH /api/tasks/[id]` | participants | Toggle completion |
| `DELETE /api/tasks/[id]` | participants | Delete task |
| `GET /api/mentorships/[id]/coach` | participants | Current (non-archived) coach history |
| `POST /api/mentorships/[id]/coach` | participants (active) | **SSE** streamed reply + task create/complete actions |
| `DELETE /api/mentorships/[id]/coach` | participants | Archive conversation → new chat |
| `POST /api/mentorships/[id]/prepare` | mentee (active) | Agenda + 5 questions for the next session |
| `GET /api/notifications` | session | Last 30 notifications + unread count |
| `PATCH /api/notifications` | session | Mark all (or one) as read |
| `GET /api/admin/stats` | admin | Metrics + skills heatmap |

## Supabase migration (production)

The full schema (tables, triggers, **RLS** and a `pgvector` hint) is in [`supabase/schema.sql`](supabase/schema.sql). Summary:

1. Create the project at [supabase.com](https://supabase.com)
2. SQL Editor → paste `supabase/schema.sql` → Run
3. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env`
4. Enable Email Auth in Authentication → Providers
5. Sync the profiles (sign-up through the UI or seed)

The data layer is isolated in `src/lib/db.ts` (Prisma) and the serializers in `src/lib/serialize.ts`, so swapping the store does not touch the screens.

## Project structure

```
src/
├─ proxy.ts                    # CSRF origin check for all /api mutations
├─ app/
│  ├─ page.tsx                 # Main SPA (single route)
│  ├─ icon.svg                 # Favicon (brand mark)
│  └─ api/                     # Backend: auth, profile, matches,
│     │                        # mentorships (respond/sessions/coach/
│     │                        # prepare/tasks), notifications, admin/stats
├─ components/app/             # UI: shell, login, wizard, dashboard,
│                              # matches, mentorship+coach, mentor panel, admin
└─ lib/
   ├─ ai.ts                    # Dual-mode AI (OpenAI ⇄ fallback), streaming,
   │                           # tolerant JSON parsing, action extraction
   ├─ matching.ts              # cosine + weighted skill overlap
   ├─ plan.ts                  # 4-session plan (AI ⇄ template)
   ├─ coach-context.ts         # Coach context + prep prompt (never generic)
   ├─ auth.ts                  # scrypt + signed httpOnly cookie
   ├─ api-utils.ts             # Error hygiene + rate limiting
   └─ db.ts                    # Prisma client
prisma/schema.prisma           # Data model (SQLite demo)
supabase/schema.sql            # Postgres schema + RLS for production
scripts/seed.ts                # Demo data (12 members, pristine state)
public/logo.svg                # Brand mark (interlocked links forming a C)
```

## Data model

`profiles` (skills + embeddings) · `mentorships` (status + plan) · `sessions` (notes + commitments) · `tasks` (due date + source) · `coach_messages` (with `archivedAt` for new conversations) · `session_preps` · `notifications`

## Technical notes

- **Matching**: score = `0.55 × weighted_skill_overlap + 0.45 × semantic_cosine`, displayed as a percentage. With OpenAI, embeddings come from `text-embedding-3-small`; without a key, a deterministic lexical embedding (light English stemming + synonyms) runs locally.
- **Coach never gives a generic answer**: every message injects the goal, plan, session history, commitments, pending tasks and recent chats into the model's prompt, and requires the reply to end with a concrete action.
- **Coach task actions have guards**: report-back sentences ("I finished...") never become tasks, quoted mentee messages are rejected as titles, extraction retries once with a strict JSON nudge, and fuzzy matching completes existing tasks at ≥0.6 token overlap.
- **Graceful degradation everywhere**: no OpenAI key → SDK chat + lexical matching + template plan; AI failure mid-reply → streamed contingency message with real mentorship data; blocked cookies → token header fallback.
- **Responsive**: mobile-first, compact bottom navigation on mobile, sticky footer.
