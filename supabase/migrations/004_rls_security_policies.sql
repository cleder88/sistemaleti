-- 1. Ativar Row Level Security (RLS) em todas as tabelas operacionais
alter table public.stores enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- 2. Limpar políticas antigas se existirem
drop policy if exists "Usuários autenticados podem visualizar lojas" on public.stores;
drop policy if exists "Usuários autenticados podem inserir lojas" on public.stores;
drop policy if exists "Usuários autenticados podem atualizar lojas" on public.stores;
drop policy if exists "Usuários autenticados podem gerenciar stores" on public.stores;
drop policy if exists "Usuários autenticados podem gerenciar orders" on public.orders;
drop policy if exists "Usuários autenticados podem gerenciar order_items" on public.order_items;
drop policy if exists "Acesso exclusivo a utilizadores autenticados" on public.stores;
drop policy if exists "Acesso exclusivo a utilizadores autenticados" on public.orders;
drop policy if exists "Acesso exclusivo a utilizadores autenticados" on public.order_items;
drop policy if exists "Acesso a PDFs apenas para autenticados" on storage.objects;

-- 3. Criar políticas que exigem login ativo via Supabase Auth
create policy "Acesso exclusivo a utilizadores autenticados"
  on public.stores
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Acesso exclusivo a utilizadores autenticados"
  on public.orders
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Acesso exclusivo a utilizadores autenticados"
  on public.order_items
  for all
  to authenticated
  using (true)
  with check (true);

-- 4. Proteger o bucket de storage dos PDFs
create policy "Acesso a PDFs apenas para autenticados"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'order-files')
  with check (bucket_id = 'order-files');
