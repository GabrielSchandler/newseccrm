alter table public.user_profiles
  add column if not exists business_area text;

update public.user_profiles
set business_area = 'commercial'
where business_area is null;

alter table public.user_profiles
  alter column business_area set default 'commercial';

alter table public.user_profiles
  alter column business_area set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_business_area_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_business_area_check
      check (business_area in ('commercial', 'legal'));
  end if;
end $$;
