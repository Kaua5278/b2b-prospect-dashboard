-- =============================================================================
-- B2B Prospect Dashboard - Database Schema
-- =============================================================================
-- Execute this in Supabase SQL Editor or via Supabase CLI
-- =============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

create type lead_status as enum (
  'new',
  'contacted',
  'replied',
  'negotiating',
  'closed_won',
  'closed_lost',
  'discarded'
);

create type phone_origin as enum (
  'owner_direct',
  'commercial_whatsapp',
  'landline_reception'
);

-- =============================================================================
-- LEADS TABLE
-- =============================================================================

create table public.leads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- Identificação única do lugar (Google Places/SerpApi)
  place_id text not null,
  
  -- Dados da empresa
  company_name text not null,
  trade_name text,
  cnpj text,
  niche text not null,
  country_code varchar(2) default 'BR',
  state varchar(2) not null,
  city text not null,
  address text,
  neighborhood text,
  zip_code varchar(8),
  latitude double precision,
  longitude double precision,
  
  -- Contato
  phone_number text not null,
  phone_type phone_origin default 'commercial_whatsapp',
  website text,
  has_website boolean default false,
  
  -- Decisor (enriquecido via CNPJ)
  decision_maker_name text,
  decision_maker_role text,
  
  -- Status do funil
  status lead_status default 'new',
  notes text,
  contacted_at timestamp with time zone,
  
  -- Metadados
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Constraint de deduplicação: mesmo usuário não pode ter o mesmo place_id duas vezes
  constraint unique_user_place unique (user_id, place_id)
);

-- Índices para performance
create index idx_leads_user_status on public.leads (user_id, status);
create index idx_leads_user_created on public.leads (user_id, created_at desc);
create index idx_leads_place_id on public.leads (place_id);
create index idx_leads_search on public.leads using gin (
  to_tsvector('portuguese', coalesce(company_name, '') || ' ' || coalesce(trade_name, '') || ' ' || coalesce(city, '') || ' ' || coalesce(niche, ''))
);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

alter table public.leads enable row level security;

-- Política: usuários só veem/editam seus próprios leads
create policy "Users can view own leads"
  on public.leads
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own leads"
  on public.leads
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own leads"
  on public.leads
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own leads"
  on public.leads
  for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- TRIGGER PARA updated_at AUTOMÁTICO
-- =============================================================================

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- FUNÇÃO PARA BUSCA FULL-TEXT (OPCIONAL)
-- =============================================================================

create or replace function public.search_leads(
  p_user_id uuid,
  p_query text,
  p_status lead_status default null,
  p_limit int default 50
)
returns setof public.leads language sql as $$
  select *
  from public.leads
  where user_id = p_user_id
    and (p_status is null or status = p_status)
    and (
      p_query = ''
      or to_tsvector('portuguese', coalesce(company_name, '') || ' ' || coalesce(trade_name, '') || ' ' || coalesce(city, '') || ' ' || coalesce(niche, ''))
         @@ plainto_tsquery('portuguese', p_query)
    )
  order by created_at desc
  limit p_limit;
$$;

-- =============================================================================
-- VIEW PARA ESTATÍSTICAS DO PIPELINE
-- =============================================================================

create view public.lead_stats as
select
  user_id,
  count(*) filter (where status = 'new') as new_count,
  count(*) filter (where status = 'contacted') as contacted_count,
  count(*) filter (where status = 'replied') as replied_count,
  count(*) filter (where status = 'negotiating') as negotiating_count,
  count(*) filter (where status = 'closed_won') as closed_won_count,
  count(*) filter (where status = 'closed_lost') as closed_lost_count,
  count(*) filter (where status = 'discarded') as discarded_count,
  count(*) as total_count
from public.leads
group by user_id;

-- =============================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =============================================================================

comment on table public.leads is 'Leads de prospecção B2B - empresas sem site próprio';
comment on column public.leads.place_id is 'ID único do Google Places/SerpApi para deduplicação';
comment on column public.leads.phone_type is 'Origem do telefone: owner_direct (WhatsApp do sócio), commercial_whatsapp (WhatsApp comercial), landline_reception (fixo/recepção)';
comment on column public.leads.decision_maker_name is 'Nome do sócio/administrador identificado via CNPJ (QSA)';
comment on index public.idx_leads_search is 'Índice GIN para busca full-text em português';