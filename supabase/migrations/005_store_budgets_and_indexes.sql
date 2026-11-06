-- Persiste os tetos de orçamento mensal por loja no banco (antes só existiam em localStorage)
alter table public.stores
  add column if not exists monthly_budget numeric(14, 2) not null default 0;

alter table public.stores
  add column if not exists monthly_items_limit numeric(12, 2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_monthly_budget_non_negative'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_monthly_budget_non_negative
      check (monthly_budget >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_monthly_items_limit_non_negative'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_monthly_items_limit_non_negative
      check (monthly_items_limit >= 0);
  end if;
end
$$;

-- Índices para acelerar agregações do Dashboard e consultas do modal de itens
create index if not exists orders_store_month_idx
  on public.orders (store_id, reference_month);

create index if not exists orders_reference_month_idx
  on public.orders (reference_month);

create index if not exists order_items_order_id_idx
  on public.order_items (order_id);
