# JCI Collarint — Skill-Based Mentoring Platform

MVP of the **JCI (Junior Chamber International)** platform that connects experienced members (mentors) with those seeking professional development (mentees), featuring **semantic skill matching** and an **AI Coach** that supports the mentee between sessions.

## MVP highlights

| Module | What it does |
|---|---|
| Onboarding | Email sign-up/login + 3-step wizard (teach / learn / goal + availability) |
| Semantic matching | Top 5 mentors by cosine similarity between embeddings, % score, shared skills and an AI-written explanation |
| Mentorship flow | Request → notification → accept/decline → AI-generated 4-session plan → scheduling → session logging |
| AI Coach | Persistent chat with full mentorship context, task creation with due dates and a "Prepare next session" button (agenda + 5 questions, with copy) |
| Mentor panel | Invites, active mentorships, upcoming sessions and the mentee's preparation view |
| Admin dashboard | Skills heatmap (abundant/scarce) + program metrics |

## Stack

- **Next.js 16 (App Router) + TypeScript**
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
6. **AI Coach**: go back to the mentee → chat with real context (goal, plan, sessions, tasks) → the Coach creates tasks with due dates
7. **Prepare next session**: generates agenda + 5 questions → copy button → the mentor sees the preparation in their panel
8. **Session**: mentor schedules, logs "what was discussed" + "commitments" and completes
9. **Admin**: sign in with `admin@jci.org.br` → skills heatmap + metrics

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
├─ app/
│  ├─ page.tsx                 # Main SPA (single route)
│  └─ api/                     # Backend: auth, profile, matches,
│     │                        # mentorships (respond/sessions/coach/
│     │                        # prepare/tasks), notifications, admin/stats
├─ components/app/             # UI: shell, login, wizard, dashboard,
│                              # matches, mentorship+coach, mentor panel, admin
└─ lib/
   ├─ ai.ts                    # Dual-mode AI (OpenAI ⇄ fallback)
   ├─ matching.ts              # cosine + weighted skill overlap
   ├─ plan.ts                  # 4-session plan (AI ⇄ template)
   ├─ coach-context.ts         # Coach context (never generic)
   ├─ auth.ts                  # scrypt + signed httpOnly cookie
   └─ db.ts                    # Prisma client
prisma/schema.prisma           # Data model (SQLite demo)
supabase/schema.sql            # Postgres schema + RLS for production
scripts/seed.ts                # Demo data
```

## Data model

`profiles` (skills + embeddings) · `mentorships` (status + plan) · `sessions` (notes + commitments) · `tasks` (due date + source) · `coach_messages` · `session_preps` · `notifications`

## Technical notes

- **Matching**: score = `0.55 × weighted_skill_overlap + 0.45 × semantic_cosine`, displayed as a percentage. With OpenAI, embeddings come from `text-embedding-3-small`; without a key, a deterministic lexical embedding (light English stemming + synonyms) runs locally.
- **Coach never gives a generic answer**: every message injects the goal, plan, session history, commitments, pending tasks and recent chats into the model's prompt, and requires the reply to end with a concrete action.
- **Security**: passwords with scrypt+salt; session in an httpOnly cookie signed with HMAC-SHA256 (`AUTH_SECRET`); authorization by participation on the API routes. A token mirror is also sent via the `x-session-token` header as a fallback for environments that block third-party cookies (e.g. previews in iframes).
- **Responsive**: mobile-first, compact bottom navigation on mobile, sticky footer.
