create table if not exists public.benefit_configs (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.benefit_configs enable row level security;

drop policy if exists "benefit configs public read" on public.benefit_configs;
create policy "benefit configs public read"
on public.benefit_configs
for select
using (true);

drop policy if exists "benefit configs public write" on public.benefit_configs;
create policy "benefit configs public write"
on public.benefit_configs
for insert
with check (true);

drop policy if exists "benefit configs public update" on public.benefit_configs;
create policy "benefit configs public update"
on public.benefit_configs
for update
using (true)
with check (true);
