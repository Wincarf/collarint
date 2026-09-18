-- ============================================================
-- JCI Collarint — Supabase (Postgres) schema with RLS
-- ============================================================
-- This schema mirrors the Prisma model used in the local demo
-- (prisma/schema.prisma). To migrate the platform from the local
-- store (SQLite) to real Supabase:
--
--   1. Create a project at https://supabase.com
--   2. SQL Editor → paste this entire file → Run
--   3. Fill in NEXT_PUBLIC_SUPABASE_URL and
--      NEXT_PUBLIC_SUPABASE_ANON_KEY in .env
--   4. Set up Auth (email) in Authentication → Providers
--   5. Populate profiles (via seed or sign-up through the UI)
--
-- Note: on Postgres we use native types (jsonb, uuid).
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

create table if not exists public.profiles (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique not null,
  password_hash       text,               -- nulo quando o usuário veio do Supabase Auth
  name                text not null,
  role_title          text,
  city                text,
  avatar_color        text not null default '#0A1F44',
  teach_skills        jsonb not null default '[]',   -- [{ name, level }]
  learn_skills        jsonb not null default '[]',   -- [{ name, level }]
  main_goal           text,
  weekly_availability text check (weekly_availability in ('1h','2h','4h+')),
  teach_embedding     jsonb,              -- { mode, vector: number[] } (pgvector opcional)
  learn_embedding     jsonb,
  onboarded           boolean not null default false,
  is_admin            boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.mentorships (
  id             uuid primary key default gen_random_uuid(),
  mentor_id      uuid not null references public.profiles(id) on delete cascade,
  mentee_id      uuid not null references public.profiles(id) on delete cascade,
  status         text not null default 'pending' check (status in ('pending','active','declined','completed')),
  invite_message text,
  plan           jsonb,                   -- { generatedBy, createdAt, sessions: [{ number, title, objective, topics[] }] }
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint mentorship_not_self check (mentor_id <> mentee_id)
);

create index if not exists idx_mentorships_mentor on public.mentorships(mentor_id);
create index if not exists idx_mentorships_mentee on public.mentorships(mentee_id);

create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  mentorship_id uuid not null references public.mentorships(id) on delete cascade,
  scheduled_at  timestamptz,
  notes         text,                     -- "O que foi discutido"
  commitments   text,                     -- "Compromissos assumidos"
  completed     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_sessions_mentorship on public.sessions(mentorship_id);

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  mentorship_id uuid not null references public.mentorships(id) on delete cascade,
  title         text not null,
  due_date      timestamptz,
  completed     boolean not null default false,
  source        text not null default 'coach' check (source in ('coach','user')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_tasks_mentorship on public.tasks(mentorship_id);

create table if not exists public.coach_messages (
  id            uuid primary key default gen_random_uuid(),
  mentorship_id uuid not null references public.mentorships(id) on delete cascade,
  role          text not null check (role in ('user','assistant')),
  content       text not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_coach_messages_mentorship on public.coach_messages(mentorship_id);

create table if not exists public.session_preps (
  id            uuid primary key default gen_random_uuid(),
  mentorship_id uuid not null references public.mentorships(id) on delete cascade,
  content       text not null,            -- pauta + 5 perguntas (markdown)
  created_at    timestamptz not null default now()
);

create index if not exists idx_session_preps_mentorship on public.session_preps(mentorship_id);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,               -- mentorship_invite | mentorship_accepted | ...
  title      text not null,
  body       text,
  payload    jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id);

-- ------------------------------------------------------------
-- Automatic updated_at
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_mentorships_updated on public.mentorships;
create trigger trg_mentorships_updated before update on public.mentorships
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security (basic RLS)
-- General rule: each member reads/writes only their own data;
-- mentorship participants access its resources.
-- ------------------------------------------------------------
-- Important: the policies below assume Supabase Auth
-- (auth.uid() = profiles.id). In demo mode with its own auth,
-- access is mediated by the Next.js API routes (service role).

alter table public.profiles        enable row level security;
alter table public.mentorships     enable row level security;
alter table public.sessions        enable row level security;
alter table public.tasks           enable row level security;
alter table public.coach_messages  enable row level security;
alter table public.session_preps   enable row level security;
alter table public.notifications   enable row level security;

-- profiles: all authenticated users can read profiles (needed for matching);
-- each one updates only their own.
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- mentorships: only participants read; the mentee requests (insert),
-- status updates by the mentor (accept/decline) or by the app itself.
drop policy if exists "mentorships_read_participant" on public.mentorships;
create policy "mentorships_read_participant" on public.mentorships
  for select using (auth.uid() = mentor_id or auth.uid() = mentee_id);

drop policy if exists "mentorships_insert_mentee" on public.mentorships;
create policy "mentorships_insert_mentee" on public.mentorships
  for insert with check (auth.uid() = mentee_id);

drop policy if exists "mentorships_update_participant" on public.mentorships;
create policy "mentorships_update_participant" on public.mentorships
  for update using (auth.uid() = mentor_id or auth.uid() = mentee_id);

-- Helper: mentorship participant (used in the child policies)
create or replace function public.is_mentorship_participant(p_mentorship uuid)
returns boolean as $$
  select exists (
    select 1 from public.mentorships m
    where m.id = p_mentorship and (m.mentor_id = auth.uid() or m.mentee_id = auth.uid())
  );
$$ language sql security definer stable;

-- sessions / tasks / coach_messages / session_preps: participants
drop policy if exists "sessions_participant_all" on public.sessions;
create policy "sessions_participant_all" on public.sessions
  for all using (public.is_mentorship_participant(mentorship_id))
  with check (public.is_mentorship_participant(mentorship_id));

drop policy if exists "tasks_participant_all" on public.tasks;
create policy "tasks_participant_all" on public.tasks
  for all using (public.is_mentorship_participant(mentorship_id))
  with check (public.is_mentorship_participant(mentorship_id));

drop policy if exists "coach_messages_participant_all" on public.coach_messages;
create policy "coach_messages_participant_all" on public.coach_messages
  for all using (public.is_mentorship_participant(mentorship_id))
  with check (public.is_mentorship_participant(mentorship_id));

drop policy if exists "session_preps_participant_all" on public.session_preps;
create policy "session_preps_participant_all" on public.session_preps
  for all using (public.is_mentorship_participant(mentorship_id))
  with check (public.is_mentorship_participant(mentorship_id));

-- notifications: owner reads/updates; inserts happen via service role (app)
drop policy if exists "notifications_read_own" on public.notifications;
create policy "notifications_read_own" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Embeddings (optional, for scale)
-- ------------------------------------------------------------
-- The demo uses cosine computed in the application over jsonb. For production
-- with thousands of members, consider pgvector:
--
--   create extension if not exists vector;
--   alter table public.profiles
--     add column teach_vec vector(1536),
--     add column learn_vec vector(1536);
--   create index on public.profiles using hnsw (learn_vec vector_cosine_ops);
--
-- text-embedding-3-small returns 1536-dimension vectors.
