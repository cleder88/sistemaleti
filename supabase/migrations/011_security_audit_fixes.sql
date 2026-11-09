-- 011_security_audit_fixes.sql
-- Correções da varredura de segurança:
--   1. Bloqueia acesso público/autenticado às tabelas de backup de duplicados.
--   2. Garante um administrador inicial sem promover todos os utilizadores.
--   3. Força security_invoker na view analítica e remove leitura ampla de PDFs.
--
-- Importante: se a migration 007 já foi executada antes desta correção, os
-- papéis promovidos em massa por ela NÃO são revertidos automaticamente.
-- Revise manualmente os administradores reais:
--   select user_id, email, role from public.user_profiles order by role, email;

-- 1. Tabelas de backup criadas pela migration 008 ---------------------------
do $$
begin
  if to_regclass('public.orders_duplicate_backup') is not null then
    execute 'alter table public.orders_duplicate_backup enable row level security';
    execute 'revoke all on public.orders_duplicate_backup from public, anon, authenticated';
  end if;

  if to_regclass('public.order_items_duplicate_backup') is not null then
    execute 'alter table public.order_items_duplicate_backup enable row level security';
    execute 'revoke all on public.order_items_duplicate_backup from public, anon, authenticated';
  end if;
end
$$;

-- 2. Salvaguarda de administrador ------------------------------------------
-- Só promove o utilizador mais antigo se não existir NENHUM administrador.
insert into public.user_profiles (user_id, email, role)
select u.id, u.email, 'admin'
from auth.users u
where not exists (
  select 1 from public.user_profiles p where p.role = 'admin'
)
order by u.created_at
limit 1
on conflict (user_id)
do update set
  email = excluded.email,
  updated_at = now();

-- 3. View analítica e Storage ----------------------------------------------
do $$
begin
  if to_regclass('public.store_monthly_analytics') is not null then
    execute 'alter view public.store_monthly_analytics set (security_invoker = true)';
    execute 'revoke all on public.store_monthly_analytics from public, anon';
  end if;
end
$$;

-- Os PDFs deixam de ser listáveis/baixáveis diretamente por qualquer
-- utilizador autenticado. O acesso passa a ser feito por URL assinada gerada
-- no servidor (rota /api/order-file) e admins mantêm a policy de gestão.
drop policy if exists "Authenticated users can read order files" on storage.objects;
