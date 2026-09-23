-- Extensao minima da fixture-base.sql pra testar 0004_atendimento_chat.sql,
-- que referencia public.clients (tabela real do CRM, fora do escopo do
-- schema aditivo de equipes/chat). So o suficiente pra resolver a FK —
-- nao reproduz nenhuma regra de negocio real de clients aqui.

create table public.clients (
    id uuid default gen_random_uuid() primary key,
    company_id uuid not null references public.companies(id),
    full_name text not null
);
alter table public.clients enable row level security;
create policy clients_all on public.clients for select using (true);
