-- ============================================================================
-- SCRIPT COMPLETO DE CONFIGURAÇÃO DO SUPABASE - CONTROLE DE PEDIDOS
-- Cole e execute este script no SQL Editor do painel do Supabase
-- ============================================================================

-- 1. Tabela de Lojas ('stores')
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  city text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- 2. Tabela de Pedidos ('orders')
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  reference_month date not null,
  pdf_url text,
  total_items numeric(12, 2) default 0,
  total_amount numeric(14, 2) default 0,
  created_at timestamptz not null default now()
);

-- 3. Tabela de Itens do Pedido ('order_items')
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_name text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(14, 2) not null default 0,
  total_price numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- 4. Políticas de Segurança (RLS)
alter table public.stores enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Usuários autenticados podem gerenciar stores" on public.stores;
create policy "Usuários autenticados podem gerenciar stores"
  on public.stores for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Usuários autenticados podem gerenciar orders" on public.orders;
create policy "Usuários autenticados podem gerenciar orders"
  on public.orders for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Usuários autenticados podem gerenciar order_items" on public.order_items;
create policy "Usuários autenticados podem gerenciar order_items"
  on public.order_items for all
  to authenticated
  using (true)
  with check (true);

-- 5. View Analítica Mensal ('store_monthly_analytics')
create or replace view public.store_monthly_analytics as
with monthly_store_orders as (
  select
    s.id as store_id,
    s.name as store_name,
    s.code as store_code,
    s.city as store_city,
    o.reference_month,
    coalesce(sum(o.total_amount), 0)::numeric(14, 2) as current_month_total,
    coalesce(sum(o.total_items), 0)::numeric(12, 2) as total_items,
    count(o.id) as orders_count
  from public.stores s
  inner join public.orders o on o.store_id = s.id
  group by s.id, s.name, s.code, s.city, o.reference_month
),
network_monthly as (
  select
    reference_month,
    coalesce(avg(current_month_total), 0)::numeric(14, 2) as network_avg
  from monthly_store_orders
  group by reference_month
),
analytics_calc as (
  select
    m.store_id,
    m.store_name,
    m.store_code,
    m.store_city,
    m.reference_month,
    m.current_month_total,
    m.total_items,
    m.orders_count,
    coalesce(
      avg(m.current_month_total) over (
        partition by m.store_id
        order by m.reference_month
        rows between 3 preceding and 1 preceding
      ),
      avg(m.current_month_total) over (
        partition by m.store_id
      ),
      0
    )::numeric(14, 2) as historical_avg,
    coalesce(n.network_avg, 0)::numeric(14, 2) as network_avg
  from monthly_store_orders m
  left join network_monthly n on n.reference_month = m.reference_month
)
select
  store_id,
  store_name,
  store_code,
  store_city,
  reference_month,
  current_month_total,
  total_items,
  orders_count,
  historical_avg,
  network_avg,
  case
    when historical_avg > 0 then
      round(((current_month_total - historical_avg) / historical_avg) * 100, 2)
    else 0
  end as diff_percentage,
  case
    when historical_avg > 0 and ((current_month_total - historical_avg) / historical_avg) * 100 > 25 then 'alert'
    when current_month_total = 0 then 'empty'
    else 'normal'
  end as status
from analytics_calc;
