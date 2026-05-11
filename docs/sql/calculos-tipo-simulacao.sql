alter table public.financing_calculations
  add column if not exists simulation_type text;

update public.financing_calculations
set simulation_type = 'veiculo'
where simulation_type is null;

alter table public.financing_calculations
  alter column simulation_type set default 'veiculo';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'financing_calculations_simulation_type_check'
  ) then
    alter table public.financing_calculations
      add constraint financing_calculations_simulation_type_check
      check (simulation_type in ('emprestimo', 'veiculo', 'imovel'));
  end if;
end $$;
