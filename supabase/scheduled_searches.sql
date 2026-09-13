-- Prospecções agendadas (rodadas pelo cron)
create table if not exists public.scheduled_searches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  niche text not null,
  state varchar(2) not null,
  city text,
  only_without_website boolean default true,
  frequency text default 'daily' check (frequency in ('daily', 'weekly')),
  active boolean default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índice para o cron buscar ativos por usuário
create index if not exists scheduled_searches_user_active_idx
  on public.scheduled_searches (user_id) where active = true;

-- RLS: cada usuário só gerencia os próprios agendamentos
alter table public.scheduled_searches enable row level security;

drop policy if exists "sched_select_own" on public.scheduled_searches;
create policy "sched_select_own" on public.scheduled_searches
  for select using (auth.uid() = user_id);

drop policy if exists "sched_insert_own" on public.scheduled_searches;
create policy "sched_insert_own" on public.scheduled_searches
  for insert with check (auth.uid() = user_id);

drop policy if exists "sched_update_own" on public.scheduled_searches;
create policy "sched_update_own" on public.scheduled_searches
  for update using (auth.uid() = user_id);

drop policy if exists "sched_delete_own" on public.scheduled_searches;
create policy "sched_delete_own" on public.scheduled_searches
  for delete using (auth.uid() = user_id);

-- Service role não é bloqueado por RLS (cron usa service_role via Supabase client? Não —
-- o cron usa o mesmo anon do cookie. Então para rodar de outros usuários o cron usa o
-- client anon autenticado... na verdade o cron roda server-side com cookie do browser
-- apenas quando manual. Para o cron do Vercel (sem sessão), usamos service_role quando
-- disponível. Essa policy garante o mínimo.
grant usage on schema public to anon, authenticated, service_role;
grant all on public.scheduled_searches to anon, authenticated, service_role;