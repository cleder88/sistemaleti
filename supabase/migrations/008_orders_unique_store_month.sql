-- 008_orders_unique_store_month.sql
-- Garante que exista no máximo um pedido por loja por mês de referência.
-- A criação é idempotente: repetir o script não causa erro.
--
-- ATENÇÃO: se já existirem pedidos duplicados, o script é interrompido com uma
-- mensagem explicativa em vez de apagar dados automaticamente. Resolva as
-- duplicidades (mantendo o pedido correto) e execute novamente.

do $$
begin
  if exists (
    select 1
    from public.orders
    group by store_id, reference_month
    having count(*) > 1
  ) then
    raise exception
      'Existem pedidos duplicados por loja/mês. Remova as duplicidades antes de criar o índice único.';
  end if;
end
$$;

create unique index if not exists orders_store_month_unique
  on public.orders (store_id, reference_month);
