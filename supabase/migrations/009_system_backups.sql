-- 009_system_backups.sql
-- Armazena snapshots completos dos dados do sistema em JSONB.
-- Cada execução do botão "Backup" cria uma linha com todo o conteúdo das
-- tabelas operacionais, permitindo recuperar os dados em caso de perda.

create table if not exists public.system_backups (
  id uuid primary key default gen_random_uuid(),
  label text,
  created_by uuid,
  created_by_email text,
  payload jsonb not null,
  table_counts jsonb not null default '{}'::jsonb,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.system_backups enable row level security;

drop policy if exists "Backups visíveis para admins" on public.system_backups;
drop policy if exists "Backups criados por admins" on public.system_backups;
drop policy if exists "Backups removíveis por admins" on public.system_backups;

create policy "Backups visíveis para admins"
  on public.system_backups
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Backups criados por admins"
  on public.system_backups
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.user_profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Backups removíveis por admins"
  on public.system_backups
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles p
      where p.user_id = auth.uid() and p.role = 'admin'
    )
  );

create index if not exists system_backups_created_at_idx
  on public.system_backups (created_at desc);
