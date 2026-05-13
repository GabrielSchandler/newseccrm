alter table public.clients
  add column if not exists legal_responsible_user_id uuid null references public.user_profiles(id) on delete set null;

create index if not exists clients_legal_responsible_user_id_idx
  on public.clients (company_id, legal_responsible_user_id);
