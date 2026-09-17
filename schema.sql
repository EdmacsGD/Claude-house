-- Claude House: database schema
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------

create table if not exists public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  age            int,
  grade          int,
  subjects       text[] not null default '{}',
  current_streak int not null default 0,
  last_active_date date,
  created_at     timestamptz not null default now()
);

create table if not exists public.skills (
  user_id    uuid not null references auth.users(id) on delete cascade,
  subject    text not null,
  difficulty int not null default 3 check (difficulty between 1 and 10),
  primary key (user_id, subject)
);

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  date       date not null,
  time       time,
  category   text not null default 'other'
             check (category in ('school', 'music', 'sport', 'other')),
  created_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id              uuid primary key default gen_random_uuid(),
  subject         text not null,
  difficulty_tier text not null check (difficulty_tier in ('easy', 'medium', 'hard')),
  type            text not null check (type in ('mc', 'typed')),
  question        text not null,
  answer          text not null,
  options         text[],
  -- a multiple-choice row must carry options; a typed row must not
  constraint options_match_type check (
    (type = 'mc' and options is not null and array_length(options, 1) >= 2)
    or (type = 'typed' and options is null)
  )
);

create table if not exists public.attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  exercise_id        uuid not null references public.exercises(id) on delete cascade,
  correct            boolean not null,
  difficulty_at_time int not null,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Indexes (the two queries the app runs most often)
-- ---------------------------------------------------------------

create index if not exists events_user_date_idx
  on public.events (user_id, date);

create index if not exists attempts_user_created_idx
  on public.attempts (user_id, created_at desc);

create index if not exists exercises_subject_tier_idx
  on public.exercises (subject, difficulty_tier);

-- ---------------------------------------------------------------
-- Row level security
-- Every user table is locked to auth.uid(). Without this, the anon
-- key in config.js would let anyone read everyone's data.
-- ---------------------------------------------------------------

alter table public.profiles  enable row level security;
alter table public.skills    enable row level security;
alter table public.events    enable row level security;
alter table public.attempts  enable row level security;
alter table public.exercises enable row level security;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() = user_id);
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = user_id);
create policy profiles_update on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists skills_select on public.skills;
drop policy if exists skills_insert on public.skills;
drop policy if exists skills_update on public.skills;
drop policy if exists skills_delete on public.skills;
create policy skills_select on public.skills
  for select using (auth.uid() = user_id);
create policy skills_insert on public.skills
  for insert with check (auth.uid() = user_id);
create policy skills_update on public.skills
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy skills_delete on public.skills
  for delete using (auth.uid() = user_id);

drop policy if exists events_select on public.events;
drop policy if exists events_insert on public.events;
drop policy if exists events_update on public.events;
drop policy if exists events_delete on public.events;
create policy events_select on public.events
  for select using (auth.uid() = user_id);
create policy events_insert on public.events
  for insert with check (auth.uid() = user_id);
create policy events_update on public.events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy events_delete on public.events
  for delete using (auth.uid() = user_id);

drop policy if exists attempts_select on public.attempts;
drop policy if exists attempts_insert on public.attempts;
create policy attempts_select on public.attempts
  for select using (auth.uid() = user_id);
create policy attempts_insert on public.attempts
  for insert with check (auth.uid() = user_id);
-- no update/delete policy: an attempt is a permanent log line

-- Exercises are shared content. Every signed-in user can read them,
-- nobody can write them from the browser (seed them from the SQL editor).
drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises
  for select to authenticated using (true);
