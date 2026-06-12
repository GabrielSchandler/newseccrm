alter table public.clients
  add column if not exists commercial_consultant_user_id uuid null references public.user_profiles(id) on delete set null;

create index if not exists clients_commercial_consultant_user_id_idx
  on public.clients (company_id, commercial_consultant_user_id);
