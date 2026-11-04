-- View 'store_monthly_analytics' para consolidar gastos mensais por loja,
-- média móvel de 3 meses da loja, média histórica da rede e percentual de desvio.

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
