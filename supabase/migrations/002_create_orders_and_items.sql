-- Criação das tabelas 'orders' e 'order_items' + Bucket 'order-files'
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  reference_month date not null,
  pdf_url text,
  total_items numeric(12, 2) default 0,
  total_amount numeric(14, 2) default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_name text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(14, 2) not null default 0,
  total_price numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Usuários autenticados podem gerenciar orders"
  on public.orders for all
  to authenticated
  using (true)
  with check (true);

create policy "Usuários autenticados podem gerenciar order_items"
  on public.order_items for all
  to authenticated
  using (true)
  with check (true);

-- Criação do bucket público 'order-files' para armazenar os PDFs originais
insert into storage.buckets (id, name, public)
values ('order-files', 'order-files', true)
on conflict (id) do nothing;
