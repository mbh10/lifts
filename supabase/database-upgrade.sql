-- LIFTS V3 DATABASE UPGRADE
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.exercises (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    exercise_key text not null,
    name text not null,
    current_weight numeric(7,2) not null default 5 check (current_weight > 0),
    weight_increment numeric(7,2) not null default 5 check (weight_increment > 0),
    failure_count integer not null default 0 check (failure_count >= 0),
    active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, exercise_key)
);

create table if not exists public.workout_template_exercises (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    exercise_id uuid not null references public.exercises(id) on delete cascade,
    workout_day text not null check (workout_day in ('A','B')),
    working_sets integer not null default 5 check (working_sets > 0 and working_sets <= 50),
    target_reps integer not null default 5 check (target_reps > 0 and target_reps <= 100),
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, exercise_id, workout_day)
);

create table if not exists public.warmup_steps (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    exercise_id uuid not null references public.exercises(id) on delete cascade,
    step_order integer not null default 0,
    warmup_sets integer not null default 1 check (warmup_sets > 0 and warmup_sets <= 20),
    warmup_reps integer not null default 5 check (warmup_reps > 0 and warmup_reps <= 100),
    weight_percentage numeric(5,2) not null default 50 check (weight_percentage > 0 and weight_percentage <= 100),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.exercise_results
    add column if not exists exercise_id uuid references public.exercises(id) on delete set null,
    add column if not exists exercise_name text,
    add column if not exists weight_increment numeric(7,2);

-- Remove the old five-exercise-only restriction, if it exists.
do $$
declare
    constraint_name text;
begin
    select conname into constraint_name
    from pg_constraint
    where conrelid = 'public.exercise_results'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%exercise_key%';

    if constraint_name is not null then
        execute format('alter table public.exercise_results drop constraint %I', constraint_name);
    end if;
end $$;

alter table public.exercises enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.warmup_steps enable row level security;

revoke all on table public.exercises from anon;
revoke all on table public.workout_template_exercises from anon;
revoke all on table public.warmup_steps from anon;

grant select, insert, update, delete on table public.exercises to authenticated;
grant select, insert, update, delete on table public.workout_template_exercises to authenticated;
grant select, insert, update, delete on table public.warmup_steps to authenticated;

drop policy if exists "Users manage their exercises" on public.exercises;
create policy "Users manage their exercises"
on public.exercises for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their workout templates" on public.workout_template_exercises;
create policy "Users manage their workout templates"
on public.workout_template_exercises for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their warmups" on public.warmup_steps;
create policy "Users manage their warmups"
on public.warmup_steps for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists exercises_user_idx on public.exercises(user_id, active, sort_order);
create index if not exists workout_template_user_day_idx on public.workout_template_exercises(user_id, workout_day, sort_order);
create index if not exists warmup_steps_user_exercise_idx on public.warmup_steps(user_id, exercise_id, step_order);


-- LIFTS V4 REST TIMER UPGRADE
alter table public.user_settings
    add column if not exists rest_seconds integer not null default 60
    check (rest_seconds >= 0 and rest_seconds <= 600);
