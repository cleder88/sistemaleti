-- Trilha de auditoria para ações de escrita (pedidos e lojas)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

drop policy if exists "Auditoria visível para autenticados" on public.audit_logs;
drop policy if exists "Auditoria gravável por autenticados" on public.audit_logs;

create policy "Auditoria visível para autenticados"
  on public.audit_logs
  for select
  to authenticated
  using (true);

create policy "Auditoria gravável por autenticados"
  on public.audit_logs
  for insert
  to authenticated
  with check (true);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity, entity_id);
