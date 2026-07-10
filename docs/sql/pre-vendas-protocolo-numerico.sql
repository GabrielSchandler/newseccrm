-- Padroniza o protocolo/numero de contrato das pre-vendas.
-- Regra: o numero de contrato GRS e o mesmo numero do protocolo publico.
-- Formato gerado para registros existentes: AAAAMMDD + sequencia global do dia.
-- Exemplo: 202607100001

begin;

with protocolos_numericos as (
  select
    id,
    to_char((created_at at time zone 'America/Sao_Paulo')::date, 'YYYYMMDD') ||
      lpad(
        row_number() over (
          partition by (created_at at time zone 'America/Sao_Paulo')::date
          order by created_at, id
        )::text,
        4,
        '0'
      ) as novo_protocolo
  from public.pre_sales
)
update public.pre_sales pre_sale
set tracking_protocol = protocolos_numericos.novo_protocolo
from protocolos_numericos
where pre_sale.id = protocolos_numericos.id
  and pre_sale.tracking_protocol is distinct from protocolos_numericos.novo_protocolo;

alter table public.pre_sales
  drop constraint if exists pre_sales_tracking_protocol_digits_only;

alter table public.pre_sales
  add constraint pre_sales_tracking_protocol_digits_only
  check (tracking_protocol is not null and tracking_protocol ~ '^[0-9]+$');

drop index if exists public.pre_sales_company_tracking_protocol_unique;
drop index if exists public.pre_sales_tracking_protocol_unique;

create unique index pre_sales_tracking_protocol_unique
  on public.pre_sales (tracking_protocol);

commit;
