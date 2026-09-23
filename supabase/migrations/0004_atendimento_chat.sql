-- Entrega C (fatia funcional minima): schema aditivo pro chat humano real.
-- Fonte dos contratos: newsecchat (maquina de estados IA/AGUARDANDO_HUMANO/
-- HUMANO/AGUARDANDO_CLIENTE/ENCERRADA, ver docs/SOURCE_INVENTORY.md secao 2)
-- + secao 9 de NEWSEC-CORRECOES-E-CONTINUACAO-CLAUDE.md (entidades e
-- contratos). Nao migra nenhum dado de teste do Chat/Focus — schema novo,
-- vazio.
--
-- Modelo de seguranca: MESMO padrao ja usado em toda tabela de negocio do
-- CRM (clients, contracts, pre_sales, etc — ver scripts/homologacao/
-- schema-producao.sql), confirmado por investigacao antes de escrever isto:
-- duas policies por tabela, "<tabela>_all_own_company" (company_id =
-- get_my_company_id()) e "<tabela>_platform_owner_all"
-- (current_user_is_platform_owner(), sem checar empresa nenhuma — o corte
-- pra uma empresa especifica quando o master troca de contexto e feito
-- 100% pela aplicacao via .eq('company_id', companyId), nunca pelo banco).
-- Nao introduzido nenhum mecanismo novo (GUC de sessao, SET LOCAL) que
-- fragmentaria esse modelo so pras tabelas de chat — decisao consciente,
-- ver docs/ARCHITECTURE.md.
--
-- Visibilidade alem de empresa (papel/equipe) e resolvida pela funcao
-- user_can_access_conversation() abaixo: admin/manager veem tudo da
-- empresa; supervisor (team_memberships.membership_role='supervisor') ve
-- as conversas da(s) equipe(s) que supervisiona; consultor ve as suas
-- atribuidas e as nao-atribuidas da(s) equipe(s) de que e membro.
--
-- Pre-condicao: 0001/0002/0003 aplicadas (teams/team_memberships e as
-- funcoes current_user_is_admin_or_manager/current_user_profile_id/
-- current_user_is_platform_owner/get_my_company_id ja existentes no CRM).

create table public.channels (
    id uuid default gen_random_uuid() primary key,
    company_id uuid not null references public.companies(id) on delete cascade,
    name text not null,
    business_area text default 'commercial' not null,
    provider text not null,
    provider_channel_external_id text,
    status text default 'active' not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    constraint channels_business_area_check check (business_area in ('commercial', 'legal')),
    constraint channels_status_check check (status in ('active', 'inactive')),
    constraint channels_provider_external_unique unique (company_id, provider, provider_channel_external_id)
);
comment on table public.channels is
    'Canal de atendimento (ex: numero de WhatsApp) de uma empresa. Roteamento pra comercial/jurídico e configuracao (business_area), nao inferido pelo numero.';
create index channels_company_id_idx on public.channels (company_id);

create table public.contacts (
    id uuid default gen_random_uuid() primary key,
    company_id uuid not null references public.companies(id) on delete cascade,
    client_id uuid references public.clients(id) on delete set null,
    display_name text,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);
comment on table public.contacts is
    'Contato operacional do atendimento — pode existir sem client cadastrado. Vinculo com clients e opcional e nunca criado automaticamente por nome/telefone.';
create index contacts_company_id_idx on public.contacts (company_id);
create index contacts_client_id_idx on public.contacts (client_id) where client_id is not null;

create table public.contact_phone_numbers (
    id uuid default gen_random_uuid() primary key,
    contact_id uuid not null references public.contacts(id) on delete cascade,
    company_id uuid not null references public.companies(id) on delete cascade,
    phone_e164 text not null,
    is_primary boolean default false not null,
    created_at timestamptz default now() not null,
    constraint contact_phone_numbers_unique unique (company_id, phone_e164)
);
comment on table public.contact_phone_numbers is
    'Numeros normalizados (E.164) de um contato — um contato pode ter varios; um numero pertence a no maximo um contato por empresa.';
create index contact_phone_numbers_contact_id_idx on public.contact_phone_numbers (contact_id);

create table public.conversations (
    id uuid default gen_random_uuid() primary key,
    company_id uuid not null references public.companies(id) on delete cascade,
    channel_id uuid not null references public.channels(id) on delete restrict,
    contact_id uuid not null references public.contacts(id) on delete restrict,
    client_id uuid references public.clients(id) on delete set null,
    team_id uuid references public.teams(id) on delete set null,
    assigned_user_profile_id uuid references public.user_profiles(id) on delete set null,
    status text default 'aguardando_humano' not null,
    last_activity_at timestamptz default now() not null,
    last_message_preview text,
    unread_count integer default 0 not null,
    first_response_at timestamptz,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    constraint conversations_status_check check (status in ('ia', 'aguardando_humano', 'humano', 'aguardando_cliente', 'encerrada'))
);
comment on table public.conversations is
    'Conversa de atendimento — vincula contato, canal, equipe (opcional, roteamento) e responsavel (opcional). Vinculo com clients e opcional, nao exige cadastro pra atender.';
create index conversations_company_id_idx on public.conversations (company_id);
create index conversations_assigned_idx on public.conversations (assigned_user_profile_id);
create index conversations_team_id_idx on public.conversations (team_id);
create index conversations_status_idx on public.conversations (company_id, status);
create index conversations_last_activity_idx on public.conversations (company_id, last_activity_at desc);

create table public.conversation_transfers (
    id uuid default gen_random_uuid() primary key,
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    company_id uuid not null references public.companies(id) on delete cascade,
    from_user_profile_id uuid references public.user_profiles(id) on delete set null,
    to_user_profile_id uuid references public.user_profiles(id) on delete set null,
    transferred_by uuid not null references public.user_profiles(id) on delete restrict,
    note text,
    created_at timestamptz default now() not null
);
comment on table public.conversation_transfers is
    'Historico de atribuicao/transferencia de conversa — auditoria de quem moveu o que, quando e pra quem.';
create index conversation_transfers_conversation_id_idx on public.conversation_transfers (conversation_id);

create table public.messages (
    id uuid default gen_random_uuid() primary key,
    company_id uuid not null references public.companies(id) on delete cascade,
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    direction text not null,
    author_type text not null,
    author_user_profile_id uuid references public.user_profiles(id) on delete set null,
    is_internal_note boolean default false not null,
    message_type text default 'texto' not null,
    body text,
    status text default 'recebida' not null,
    external_id text,
    idempotency_key text,
    failed_reason text,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    sent_at timestamptz,
    delivered_at timestamptz,
    read_at timestamptz,
    constraint messages_direction_check check (direction in ('entrada', 'saida')),
    constraint messages_author_type_check check (author_type in ('cliente', 'humano', 'ia', 'sistema')),
    constraint messages_type_check check (message_type in ('texto', 'documento', 'audio', 'imagem', 'video', 'nota')),
    constraint messages_status_check check (status in ('recebida', 'criada', 'pendente', 'enviada', 'entregue', 'lida', 'falha'))
);
comment on table public.messages is
    'Mensagem (ou nota interna, is_internal_note=true) de uma conversa. Nota interna nunca e enviada ao provedor — reforcado por trigger em outbound_jobs, nao so por disciplina de aplicacao.';
create index messages_conversation_id_idx on public.messages (conversation_id, created_at);
create index messages_company_id_idx on public.messages (company_id);
create unique index messages_external_id_unique on public.messages (conversation_id, external_id) where external_id is not null;
create unique index messages_idempotency_key_unique on public.messages (conversation_id, idempotency_key) where idempotency_key is not null;

create table public.message_attachments (
    id uuid default gen_random_uuid() primary key,
    message_id uuid not null references public.messages(id) on delete cascade,
    company_id uuid not null references public.companies(id) on delete cascade,
    storage_path text not null,
    content_type text,
    file_name text,
    size_bytes bigint,
    created_at timestamptz default now() not null
);
comment on table public.message_attachments is
    'Anexo de mensagem — arquivo fica em bucket privado do Storage (storage_path), nunca em URL publica/arbitraria.';
create index message_attachments_message_id_idx on public.message_attachments (message_id);

create table public.inbound_events (
    id uuid default gen_random_uuid() primary key,
    company_id uuid not null references public.companies(id) on delete cascade,
    channel_id uuid not null references public.channels(id) on delete cascade,
    provider text not null,
    external_event_id text not null,
    payload jsonb not null,
    processed_at timestamptz,
    created_at timestamptz default now() not null,
    constraint inbound_events_unique unique (channel_id, provider, external_event_id)
);
comment on table public.inbound_events is
    'Dedup de evento recebido do provedor (webhook) — unicidade por canal+provedor+id externo. Reprocessar o mesmo evento (replay) nao duplica nada, so bate na unique e para.';
create index inbound_events_company_id_idx on public.inbound_events (company_id);

create table public.outbound_jobs (
    id uuid default gen_random_uuid() primary key,
    company_id uuid not null references public.companies(id) on delete cascade,
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    message_id uuid not null references public.messages(id) on delete cascade,
    idempotency_key text not null,
    status text default 'pendente' not null,
    attempts integer default 0 not null,
    max_attempts integer default 5 not null,
    next_attempt_at timestamptz default now() not null,
    last_error text,
    locked_at timestamptz,
    locked_by text,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    constraint outbound_jobs_status_check check (status in ('pendente', 'processando', 'enviado', 'falha')),
    constraint outbound_jobs_message_unique unique (message_id),
    constraint outbound_jobs_idempotency_unique unique (idempotency_key)
);
comment on table public.outbound_jobs is
    'Fila de envio (outbox), processada pelo worker persistente via SELECT ... FOR UPDATE SKIP LOCKED — nunca por funcao serverless. idempotency_key evita duplicar envio real no provedor em caso de reenvio/retry.';
create index outbound_jobs_pending_idx on public.outbound_jobs (next_attempt_at) where status = 'pendente';

-- Integridade: author_user_profile_id (quando presente) precisa pertencer a
-- mesma empresa da mensagem — mesma filosofia de 0002 (trigger estrutural,
-- nao so RLS/disciplina de aplicacao).
create or replace function public.enforce_message_author_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.author_user_profile_id is not null
       and not public.user_belongs_to_company(new.author_user_profile_id, new.company_id) then
        raise exception
            'Autor % nao pertence a empresa % da mensagem — recusado.',
            new.author_user_profile_id, new.company_id
            using errcode = 'NS010';
    end if;
    return new;
end;
$$;
drop trigger if exists messages_enforce_author_company on public.messages;
create trigger messages_enforce_author_company
    before insert or update of author_user_profile_id, company_id
    on public.messages
    for each row
    execute function public.enforce_message_author_company();

-- Integridade: company_id da mensagem precisa bater com o da conversa —
-- evita erro de aplicacao gravando mensagem "vazando" pra empresa errada.
create or replace function public.enforce_message_conversation_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_conversation_company_id uuid;
begin
    select company_id into v_conversation_company_id
    from public.conversations
    where id = new.conversation_id;

    if v_conversation_company_id is null then
        raise exception 'Conversa % nao encontrada.', new.conversation_id using errcode = 'NS011';
    end if;

    if new.company_id <> v_conversation_company_id then
        raise exception
            'company_id da mensagem (%) diverge da empresa da conversa % (%) — recusado.',
            new.company_id, new.conversation_id, v_conversation_company_id
            using errcode = 'NS012';
    end if;

    return new;
end;
$$;
drop trigger if exists messages_enforce_conversation_company on public.messages;
create trigger messages_enforce_conversation_company
    before insert or update of conversation_id, company_id
    on public.messages
    for each row
    execute function public.enforce_message_conversation_company();

-- Nota interna nunca pode virar job de envio ao provedor — trava estrutural,
-- nao so disciplina de codigo do worker/action.
create or replace function public.prevent_outbound_job_for_internal_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_is_note boolean;
begin
    select is_internal_note into v_is_note
    from public.messages
    where id = new.message_id;

    if v_is_note is null then
        raise exception 'Mensagem % nao encontrada.', new.message_id using errcode = 'NS013';
    end if;

    if v_is_note then
        raise exception
            'Mensagem % e uma nota interna — nao pode gerar job de envio ao provedor.',
            new.message_id
            using errcode = 'NS014';
    end if;

    return new;
end;
$$;
drop trigger if exists outbound_jobs_prevent_internal_note on public.outbound_jobs;
create trigger outbound_jobs_prevent_internal_note
    before insert
    on public.outbound_jobs
    for each row
    execute function public.prevent_outbound_job_for_internal_note();

-- Visibilidade de conversa alem de empresa: admin/manager veem tudo da
-- empresa; supervisor ve as equipes que supervisiona; consultor ve as suas
-- atribuidas e as nao-atribuidas da(s) equipe(s) de que e membro.
create or replace function public.user_can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((
        select
            public.current_user_is_platform_owner()
            or (
                c.company_id = public.get_my_company_id()
                and (
                    public.current_user_is_admin_or_manager()
                    or c.assigned_user_profile_id = public.current_user_profile_id()
                    or exists (
                        select 1 from public.team_memberships tm
                        where tm.user_profile_id = public.current_user_profile_id()
                          and tm.team_id = c.team_id
                          and tm.membership_role = 'supervisor'
                    )
                    or (
                        c.assigned_user_profile_id is null
                        and c.team_id is not null
                        and exists (
                            select 1 from public.team_memberships tm
                            where tm.user_profile_id = public.current_user_profile_id()
                              and tm.team_id = c.team_id
                        )
                    )
                )
            )
        from public.conversations c
        where c.id = p_conversation_id
    ), false);
$$;
comment on function public.user_can_access_conversation(uuid) is
    'Fonte unica de verdade pra "este usuario pode ver/agir nesta conversa?" — usada em RLS de conversations, messages, conversation_transfers e message_attachments.';
revoke all on function public.user_can_access_conversation(uuid) from public;
grant execute on function public.user_can_access_conversation(uuid) to authenticated, service_role;

alter table public.channels enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_phone_numbers enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_transfers enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.inbound_events enable row level security;
alter table public.outbound_jobs enable row level security;

-- channels: leitura pra qualquer ativo da empresa; escrita so admin/manager.
create policy channels_all_own_company on public.channels
    for all
    using (company_id = public.get_my_company_id() and public.current_user_is_active())
    with check (company_id = public.get_my_company_id() and public.current_user_is_admin_or_manager());
create policy channels_platform_owner_all on public.channels
    to authenticated
    using (public.current_user_is_platform_owner())
    with check (public.current_user_is_platform_owner());

-- contacts / contact_phone_numbers: leitura/escrita pra qualquer ativo da
-- empresa — visibilidade fina fica na conversa, nao no contato em si (um
-- contato pode ter conversas visiveis a uns e nao a outros).
create policy contacts_all_own_company on public.contacts
    for all
    using (company_id = public.get_my_company_id() and public.current_user_is_active())
    with check (company_id = public.get_my_company_id() and public.current_user_is_active());
create policy contacts_platform_owner_all on public.contacts
    to authenticated
    using (public.current_user_is_platform_owner())
    with check (public.current_user_is_platform_owner());

create policy contact_phone_numbers_all_own_company on public.contact_phone_numbers
    for all
    using (company_id = public.get_my_company_id() and public.current_user_is_active())
    with check (company_id = public.get_my_company_id() and public.current_user_is_active());
create policy contact_phone_numbers_platform_owner_all on public.contact_phone_numbers
    to authenticated
    using (public.current_user_is_platform_owner())
    with check (public.current_user_is_platform_owner());

-- conversations: visibilidade fina via user_can_access_conversation().
create policy conversations_select on public.conversations
    for select
    using (public.user_can_access_conversation(id));
create policy conversations_insert on public.conversations
    for insert
    with check (
        public.current_user_is_platform_owner()
        or (company_id = public.get_my_company_id() and public.current_user_is_admin_or_manager())
    );
create policy conversations_update on public.conversations
    for update
    using (public.user_can_access_conversation(id))
    with check (
        public.current_user_is_platform_owner()
        or (
            company_id = public.get_my_company_id()
            and (
                public.current_user_is_admin_or_manager()
                or assigned_user_profile_id = public.current_user_profile_id()
                or exists (
                    select 1 from public.team_memberships tm
                    where tm.user_profile_id = public.current_user_profile_id()
                      and tm.team_id = conversations.team_id
                      and tm.membership_role = 'supervisor'
                )
            )
        )
    );

create policy conversation_transfers_select on public.conversation_transfers
    for select
    using (public.user_can_access_conversation(conversation_id));
create policy conversation_transfers_insert on public.conversation_transfers
    for insert
    with check (public.user_can_access_conversation(conversation_id));

create policy messages_select on public.messages
    for select
    using (public.user_can_access_conversation(conversation_id));
create policy messages_insert on public.messages
    for insert
    with check (public.user_can_access_conversation(conversation_id));

create policy message_attachments_select on public.message_attachments
    for select
    using (exists (
        select 1 from public.messages m
        where m.id = message_attachments.message_id
          and public.user_can_access_conversation(m.conversation_id)
    ));
create policy message_attachments_insert on public.message_attachments
    for insert
    with check (exists (
        select 1 from public.messages m
        where m.id = message_attachments.message_id
          and public.user_can_access_conversation(m.conversation_id)
    ));

-- inbound_events / outbound_jobs: operacionais, escritos/lidos pelo servidor
-- (webhook handler, server actions, worker) — todos via service_role, que
-- ignora RLS. Policy aqui e so defesa em profundidade caso algo tente
-- acessar via client comum no futuro; ninguem hoje deveria precisar disso.
create policy inbound_events_platform_or_admin on public.inbound_events
    for all
    using (
        public.current_user_is_platform_owner()
        or (company_id = public.get_my_company_id() and public.current_user_is_admin_or_manager())
    )
    with check (
        public.current_user_is_platform_owner()
        or (company_id = public.get_my_company_id() and public.current_user_is_admin_or_manager())
    );

create policy outbound_jobs_platform_or_admin on public.outbound_jobs
    for all
    using (
        public.current_user_is_platform_owner()
        or (company_id = public.get_my_company_id() and public.current_user_is_admin_or_manager())
    )
    with check (
        public.current_user_is_platform_owner()
        or (company_id = public.get_my_company_id() and public.current_user_is_admin_or_manager())
    );
