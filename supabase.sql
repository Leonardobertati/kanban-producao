create table if not exists public.kanban_state (
  id integer primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.kanban_state enable row level security;

drop policy if exists "public read kanban_state" on public.kanban_state;
create policy "public read kanban_state"
on public.kanban_state
for select
to anon
using (true);

drop policy if exists "public write kanban_state" on public.kanban_state;
create policy "public write kanban_state"
on public.kanban_state
for insert
to anon
with check (true);

drop policy if exists "public update kanban_state" on public.kanban_state;
create policy "public update kanban_state"
on public.kanban_state
for update
to anon
using (true)
with check (true);
