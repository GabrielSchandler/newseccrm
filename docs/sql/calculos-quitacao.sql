alter table public.financing_calculations
  add column if not exists settlement_discount_percentage numeric(5,2),
  add column if not exists settlement_amount numeric(14,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'financing_calculations_settlement_discount_percentage_check'
  ) then
    alter table public.financing_calculations
      add constraint financing_calculations_settlement_discount_percentage_check
      check (
        settlement_discount_percentage is null
        or (
          settlement_discount_percentage >= 0
          and settlement_discount_percentage <= 100
        )
      );
  end if;
end $$;

comment on column public.financing_calculations.settlement_discount_percentage is
  'Percentual opcional de desconto aplicado sobre o saldo devedor pos correcao para estimar quitacao.';

comment on column public.financing_calculations.settlement_amount is
  'Valor calculado para quitacao apos aplicar o percentual opcional sobre o saldo devedor pos correcao.';
