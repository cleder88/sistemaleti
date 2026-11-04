-- Criação da tabela 'stores' no Supabase
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  city text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

alter table public.stores enable row level security;

create policy "Usuários autenticados podem visualizar lojas"
  on public.stores for select
  to authenticated
  using (true);

create policy "Usuários autenticados podem inserir lojas"
  on public.stores for insert
  to authenticated
  with check (true);

create policy "Usuários autenticados podem atualizar lojas"
  on public.stores for update
  to authenticated
  using (true)
  with check (true);
