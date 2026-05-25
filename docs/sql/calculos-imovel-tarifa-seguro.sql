-- Adiciona campos de tarifa administrativa e seguros para simulações de imóvel
-- Esses campos são opcionais e só são preenchidos quando simulation_type = 'imovel'

alter table public.financing_calculations
  add column if not exists administrative_fee numeric(15, 2) null;

alter table public.financing_calculations
  add column if not exists insurance_value numeric(15, 2) null;

comment on column public.financing_calculations.administrative_fee is
  'Tarifa administrativa por parcela (apenas para simulações de imóvel)';

comment on column public.financing_calculations.insurance_value is
  'Valor de seguros por parcela (apenas para simulações de imóvel)';
