alter table public.financing_calculations
  add column if not exists protocol_number text;

create unique index if not exists financing_calculations_protocol_number_unique_idx
  on public.financing_calculations (protocol_number)
  where protocol_number is not null;
