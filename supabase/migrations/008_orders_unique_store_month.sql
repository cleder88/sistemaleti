-- 008_orders_unique_store_month.sql
-- Garante que exista no máximo um pedido por loja por mês de referência.
--
-- Antes de criar o índice único, as duplicidades existentes são copiadas para
-- tabelas de backup (orders_duplicate_backup / order_items_duplicate_backup) e
-- removidas, mantendo o pedido MAIS RECENTE (created_at) de cada loja/mês.
-- Assim, nenhum dado é perdido sem possibilidade de recuperação.
--
-- O script é idempotente: pode ser executado novamente sem erros.

-- 1. Tabelas de backup (criadas vazias na primeira execução)
create table if not exists public.orders_duplicate_backup as
select * from public.orders where false;

create table if not exists public.order_items_duplicate_backup as
select * from public.order_items where false;

-- 2. Copia para o backup os pedidos que serão removidos (todos menos o mais recente)
with ranked as (
  select
    id,
    row_number() over (
      partition by store_id, reference_month
      order by created_at desc, id desc
    ) as rn
  from public.orders
)
insert into public.orders_duplicate_backup
select o.*
from public.orders o
join ranked r on r.id = o.id
where r.rn > 1;

-- 3. Copia também os itens dos pedidos duplicados
insert into public.order_items_duplicate_backup
select i.*
from public.order_items i
where i.order_id in (select id from public.orders_duplicate_backup);

-- 4. Remove os pedidos duplicados (os itens caem por ON DELETE CASCADE)
with ranked as (
  select
    id,
    row_number() over (
      partition by store_id, reference_month
      order by created_at desc, id desc
    ) as rn
  from public.orders
)
delete from public.orders o
using ranked r
where o.id = r.id and r.rn > 1;

-- 5. Cria o índice único definitivo
create unique index if not exists orders_store_month_unique
  on public.orders (store_id, reference_month);
