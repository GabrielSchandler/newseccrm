alter table public.financing_calculations
  add column if not exists installment_reduction_percentage numeric(5,2) default 30;

update public.financing_calculations
set installment_reduction_percentage = 30
where installment_reduction_percentage is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'financing_calculations_installment_reduction_percentage_check'
  ) then
    alter table public.financing_calculations
      add constraint financing_calculations_installment_reduction_percentage_check
      check (
        installment_reduction_percentage is null
        or (
          installment_reduction_percentage >= 0
          and installment_reduction_percentage <= 100
        )
      );
  end if;
end $$;
