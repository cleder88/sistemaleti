-- 010_system_reset_codes.sql
-- Códigos de segurança enviados por e-mail para confirmar a formatação
-- completa dos dados do sistema. Os códigos são guardados apenas como hash.

create table if not exists public.system_reset_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.system_reset_codes enable row level security;

-- Apenas o service role (usado pelas rotas do servidor) acede a esta tabela.
drop policy if exists "Códigos de reset apenas para admins" on public.system_reset_codes;

create index if not exists system_reset_codes_user_created_idx
  on public.system_reset_codes (user_id, created_at desc);

create index if not exists system_reset_codes_expires_idx
  on public.system_reset_codes (expires_at);
