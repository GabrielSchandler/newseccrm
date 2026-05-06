alter table public.pre_sales
  add column if not exists payment_description text;
