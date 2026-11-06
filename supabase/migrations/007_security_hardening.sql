-- 007_security_hardening.sql
-- Perfis de usuário e RLS por papel: admin tem acesso total; operator pode
-- consultar dados e criar pedidos/itens, mas não gerencia lojas, pedidos
-- existentes, auditoria ou Storage.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'operator' check (role in ('admin', 'operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.user_profiles (user_id, email, role)
  values (new.id, new.email, 'operator')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into public.user_profiles (user_id, email, role)
select id, email, 'admin'
from auth.users
on conflict (user_id)
do update set
  email = excluded.email,
  role = 'admin',
  updated_at = now();

drop policy if exists "Users can read own profile" on public.user_profiles;
drop policy if exists "Admins can manage user profiles" on public.user_profiles;
create policy "Users can read own profile"
  on public.user_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admins can manage user profiles"
  on public.user_profiles
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Usuários autenticados podem visualizar lojas" on public.stores;
drop policy if exists "Usuários autenticados podem inserir lojas" on public.stores;
drop policy if exists "Usuários autenticados podem atualizar lojas" on public.stores;
drop policy if exists "Usuários autenticados podem gerenciar stores" on public.stores;
drop policy if exists "Acesso exclusivo a utilizadores autenticados" on public.stores;

create policy "Authenticated users can read stores"
  on public.stores
  for select
  to authenticated
  using (true);

create policy "Admins can insert stores"
  on public.stores
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update stores"
  on public.stores
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete stores"
  on public.stores
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Usuários autenticados podem gerenciar orders" on public.orders;
drop policy if exists "Acesso exclusivo a utilizadores autenticados" on public.orders;

create policy "Authenticated users can read orders"
  on public.orders
  for select
  to authenticated
  using (true);

create policy "Authenticated users can create orders"
  on public.orders
  for insert
  to authenticated
  with check (true);

create policy "Admins can update orders"
  on public.orders
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete orders"
  on public.orders
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Usuários autenticados podem gerenciar order_items" on public.order_items;
drop policy if exists "Acesso exclusivo a utilizadores autenticados" on public.order_items;

create policy "Authenticated users can read order items"
  on public.order_items
  for select
  to authenticated
  using (true);

create policy "Authenticated users can create order items"
  on public.order_items
  for insert
  to authenticated
  with check (true);

create policy "Admins can update order items"
  on public.order_items
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete order items"
  on public.order_items
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Auditoria visível para autenticados" on public.audit_logs;
drop policy if exists "Auditoria gravável por autenticados" on public.audit_logs;

create policy "Admins can read audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Acesso a PDFs apenas para autenticados" on storage.objects;
drop policy if exists "Authenticated users can read order files" on storage.objects;
drop policy if exists "Authenticated users can upload order files" on storage.objects;
drop policy if exists "Admins can manage order files" on storage.objects;

create policy "Authenticated users can read order files"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'order-files');

create policy "Authenticated users can upload order files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'order-files'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{4}-[0-9]{2}-[0-9]{2}/[^/]+$'
  );

create policy "Admins can manage order files"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'order-files' and public.is_admin())
  with check (bucket_id = 'order-files' and public.is_admin());
