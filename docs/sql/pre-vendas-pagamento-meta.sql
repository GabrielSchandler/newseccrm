alter table public.pre_sale_payments
  add column if not exists goal_amount numeric(12, 2);
