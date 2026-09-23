-- ATENÇÃO: arquivo gerado como conveniência pra colar de uma vez no SQL Editor
-- do Supabase de homologação. Combina, NA ORDEM, as 5 migrações pendentes
-- (0001 a 0005 em supabase/migrations/) — os arquivos individuais lá continuam
-- sendo a fonte de verdade versionada; este aqui é só um atalho de uma vez só.
-- Depois de rodar, pode apagar este arquivo (não precisa versionar).

-- ============================================================
-- 0001_equipes.sql
-- ============================================================
-- Equipes e vinculo supervisor/membro <-> equipe (N:N).
--
-- Objetivo: o CRM hoje nao tem conceito de equipe nenhum (so o Focus tem,
-- separado, e la um lider fica restrito a UMA equipe via coluna escalar —
-- ver docs/SOURCE_INVENTORY.md secao 3.3). A especificacao pede supervisor
-- em varias equipes (secao 5). Esta migracao cria a base para isso dentro
-- do CRM, de forma aditiva: nenhuma tabela existente e alterada, nenhum
-- codigo hoje le estas tabelas, entao aplicar isto tem risco de regressao
-- zero sobre o que ja funciona.
--
-- Pre-condicoes: tabelas public.companies e public.user_profiles ja
-- existem (schema do GRSCRM). Funcoes current_user_company_id(),
-- current_user_is_active(), current_user_is_admin_or_manager() e
-- current_user_profile_id() ja existem (docs/sql/security-multi-tenant-rls.sql
-- no CRM de origem) e sao reaproveitadas aqui para manter a mesma regra de
-- isolamento por empresa que o resto do banco ja usa.
--
-- Nao inclui: vinculo usuario <-> multiplas empresas (isso muda
-- src/lib/auth/current-user.ts e src/lib/supabase/middleware.ts, codigo de
-- autenticacao critico; requer sessao dedicada de teste com 2+ empresas
-- antes de mudar, nao entra numa migracao "de passagem" — ver
-- docs/PERMISSIONS.md secao 3).
--
-- Impacto no CRM antigo (GRSCRM, banco de producao): nenhum, ate esta
-- migracao ser aplicada la. Aplicada, tambem nao muda nenhum comportamento
-- existente — so acrescenta tabelas novas que nada consome ainda.
-- Estrategia de recuperacao: `drop table if exists public.team_memberships;
-- drop table if exists public.teams;` — seguro enquanto nada grava dados
-- reais nelas.

create table public.teams (
    id uuid default gen_random_uuid() primary key,
    company_id uuid not null references public.companies(id) on delete cascade,
    name text not null,
    business_area text default 'commercial' not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    constraint teams_business_area_check check (business_area in ('commercial', 'legal')),
    constraint teams_company_name_unique unique (company_id, name)
);

comment on table public.teams is
    'Equipes dentro de uma empresa. Novo no NewSec — o CRM original (GRSCRM) nao tinha esse conceito.';

create index teams_company_id_idx on public.teams (company_id);

create table public.team_memberships (
    id uuid default gen_random_uuid() primary key,
    team_id uuid not null references public.teams(id) on delete cascade,
    user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
    membership_role text default 'member' not null,
    created_at timestamp with time zone default now() not null,
    constraint team_memberships_role_check check (membership_role in ('supervisor', 'member')),
    constraint team_memberships_unique unique (team_id, user_profile_id)
);

comment on table public.team_memberships is
    'Vinculo usuario <-> equipe (N:N). Um user_profile pode estar em varias equipes, '
    'inclusive como supervisor de mais de uma — diferente da restricao de 1 equipe do Focus.';

create index team_memberships_user_profile_id_idx on public.team_memberships (user_profile_id);
create index team_memberships_team_id_idx on public.team_memberships (team_id);

alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;

-- Leitura: qualquer usuario ativo da mesma empresa ve as equipes dela.
create policy teams_select on public.teams
    for select
    using (
        current_user_is_active()
        and company_id = current_user_company_id()
    );

-- Escrita: só admin/manager da empresa cria/edita/apaga equipes.
create policy teams_insert on public.teams
    for insert
    with check (
        current_user_is_admin_or_manager()
        and company_id = current_user_company_id()
    );

create policy teams_update on public.teams
    for update
    using (
        current_user_is_admin_or_manager()
        and company_id = current_user_company_id()
    )
    with check (
        current_user_is_admin_or_manager()
        and company_id = current_user_company_id()
    );

create policy teams_delete on public.teams
    for delete
    using (
        current_user_is_admin_or_manager()
        and company_id = current_user_company_id()
    );

-- team_memberships nao tem company_id proprio — o isolamento passa pela
-- equipe (public.teams), que ja tem RLS por empresa.
create policy team_memberships_select on public.team_memberships
    for select
    using (
        current_user_is_active()
        and exists (
            select 1 from public.teams t
            where t.id = team_memberships.team_id
              and t.company_id = current_user_company_id()
        )
    );

create policy team_memberships_insert on public.team_memberships
    for insert
    with check (
        current_user_is_admin_or_manager()
        and exists (
            select 1 from public.teams t
            where t.id = team_memberships.team_id
              and t.company_id = current_user_company_id()
        )
    );

create policy team_memberships_update on public.team_memberships
    for update
    using (
        current_user_is_admin_or_manager()
        and exists (
            select 1 from public.teams t
            where t.id = team_memberships.team_id
              and t.company_id = current_user_company_id()
        )
    )
    with check (
        current_user_is_admin_or_manager()
        and exists (
            select 1 from public.teams t
            where t.id = team_memberships.team_id
              and t.company_id = current_user_company_id()
        )
    );

create policy team_memberships_delete on public.team_memberships
    for delete
    using (
        current_user_is_admin_or_manager()
        and exists (
            select 1 from public.teams t
            where t.id = team_memberships.team_id
              and t.company_id = current_user_company_id()
        )
    );

-- ============================================================
-- GRANT necessário entre 0001 e 0002 (normalmente feito pelo script de teste;
-- em homologação real o Supabase já concede isso via role authenticated padrão,
-- mas incluído aqui por segurança)
-- ============================================================
grant select, insert, update, delete on public.teams, public.team_memberships to authenticated, service_role;

-- ============================================================
-- 0002_equipes_integridade_empresa.sql
-- ============================================================
-- Corrige uma lacuna real de integridade em 0001_equipes.sql: as policies
-- de team_memberships conferiam a empresa da EQUIPE e o papel do ATOR, mas
-- nunca conferiam se o USUARIO-ALVO (user_profile_id sendo inserido/
-- atualizado) de fato pertence aquela empresa. Um admin/manager da empresa A
-- podia, em tese, vincular o user_profile de um usuario da empresa B a uma
-- equipe da empresa A, bastando conhecer o UUID dele.
--
-- Esta migracao e uma correcao INCREMENTAL, nao uma reescrita de
-- 0001_equipes.sql — aplicada tanto se 0001 ja rodou em algum ambiente
-- quanto se ainda nao rodou (idempotente via CREATE OR REPLACE / DROP ...
-- IF EXISTS). Nao pressupor que o arquivo antigo sozinho, editado depois
-- dele ja ter sido aplicado, corrigiria um banco onde ele ja rodou.
--
-- Importante: a checagem abaixo usa user_profiles.company_id (a fonte de
-- verdade ATUAL, 1 empresa por perfil). Quando a fundacao de vinculo
-- usuario<->empresa N:N (company_memberships) existir, esta funcao precisa
-- ser atualizada para consultar aquela tabela em vez do campo legado —
-- deixar isso registrado aqui explicitamente para nao ser esquecido.
--
-- Pre-condicao: 0001_equipes.sql (tabelas teams/team_memberships) aplicada.
--
-- Verificacao antes de travar: como as tabelas sao novas e nenhum codigo
-- ainda escreve nelas (Fase 1 nao consome team_memberships em nenhuma
-- tela), nao ha necessidade de reassociar dados existentes — mas, por
-- seguranca, o bloco abaixo verifica e aborta com erro claro em vez de
-- corrigir silenciosamente, caso encontre uma linha ja inconsistente.
--
-- SQLSTATEs customizados usados nos triggers abaixo (retificado 23/09,
-- sem mudar a logica de validacao — so pra permitir teste automatizado
-- de verdade em vez de inspecao manual de mensagem, ver
-- supabase/tests/0002_equipes_integridade_empresa.test.sql):
--   NS001 — equipe do vinculo nao existe.
--   NS002 — usuario-alvo de empresa diferente da equipe (integridade).
--   NS003 — tentativa de mudar company_id de uma equipe existente.

do $$
declare
    v_inconsistentes integer;
begin
    select count(*) into v_inconsistentes
    from public.team_memberships tm
    join public.teams t on t.id = tm.team_id
    join public.user_profiles up on up.id = tm.user_profile_id
    where up.company_id <> t.company_id;

    if v_inconsistentes > 0 then
        raise exception
            'Encontradas % linhas em team_memberships com usuario de empresa diferente da equipe. '
            'Revise manualmente antes de aplicar esta migracao (nao apagar/reassociar automaticamente).',
            v_inconsistentes;
    end if;
end $$;

-- Helper reaproveitavel: hoje consulta user_profiles.company_id; atualizar
-- aqui (so aqui) quando company_memberships existir.
create or replace function public.user_belongs_to_company(p_user_profile_id uuid, p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.user_profiles up
        where up.id = p_user_profile_id
          and up.company_id = p_company_id
    );
$$;

comment on function public.user_belongs_to_company(uuid, uuid) is
    'Fonte de verdade unica para "este user_profile pertence a esta empresa?". '
    'Hoje consulta user_profiles.company_id (1:1). Atualizar quando existir '
    'company_memberships (N:N) — nao duplicar essa checagem em outro lugar.';

revoke all on function public.user_belongs_to_company(uuid, uuid) from public;
grant execute on function public.user_belongs_to_company(uuid, uuid) to authenticated, service_role;

-- Trigger de integridade estrutural: roda pra QUALQUER conexao, inclusive
-- service role (que ignora RLS) e scripts administrativos — RLS sozinha
-- nao bloqueia bypass de RLS, um trigger de tabela bloqueia.
create or replace function public.enforce_team_membership_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_team_company_id uuid;
begin
    select company_id into v_team_company_id
    from public.teams
    where id = new.team_id;

    if v_team_company_id is null then
        raise exception 'Equipe % nao encontrada.', new.team_id
            using errcode = 'NS001';
    end if;

    if not public.user_belongs_to_company(new.user_profile_id, v_team_company_id) then
        raise exception
            'Usuario % nao pertence a mesma empresa da equipe % — vinculo recusado.',
            new.user_profile_id, new.team_id
            using errcode = 'NS002';
    end if;

    return new;
end;
$$;

drop trigger if exists team_memberships_enforce_company on public.team_memberships;
create trigger team_memberships_enforce_company
    before insert or update of team_id, user_profile_id
    on public.team_memberships
    for each row
    execute function public.enforce_team_membership_company();

-- Empresa de uma equipe e imutavel depois de criada: "mover" uma equipe pra
-- outra empresa invalidaria silenciosamente os vinculos existentes (que
-- passariam a apontar pra usuarios de uma empresa diferente da nova). Se um
-- dia isso for necessario de verdade, fazer explicitamente (apagar os
-- vinculos antigos primeiro), nao via UPDATE direto de company_id.
create or replace function public.prevent_team_company_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.company_id <> old.company_id then
        raise exception
            'Nao e permitido mudar a empresa de uma equipe existente (equipe %). '
            'Crie uma equipe nova na empresa correta em vez de mover esta.',
            old.id
            using errcode = 'NS003';
    end if;
    return new;
end;
$$;

drop trigger if exists teams_prevent_company_change on public.teams;
create trigger teams_prevent_company_change
    before update of company_id
    on public.teams
    for each row
    execute function public.prevent_team_company_change();

-- ============================================================
-- 0003_equipes_integridade_transferencia_empresa.sql
-- ============================================================
-- Corrige uma lacuna de integridade nao coberta por 0002: o trigger de la
-- so valida no INSERT/UPDATE de team_memberships — nunca quando
-- user_profiles.company_id muda por fora (ex: um admin move um usuario pra
-- outra empresa). Se isso acontecer com vinculos de equipe existentes, eles
-- ficam apontando pra uma equipe de empresa diferente da nova empresa do
-- usuario — a mesma inconsistencia que 0002 bloqueia, so que pelo lado
-- inverso (mudou o usuario, nao o vinculo).
--
-- Nao ha hoje nenhuma tela/action no CRM que exponha editar company_id de
-- um user_profile ja existente (usuarios sao criados escopados pela empresa
-- ativa) — mas a coluna e um campo comum, sem constraint que impeca UPDATE
-- direto (ex: script administrativo, SQL Editor). Fechar a lacuna na
-- origem em vez de confiar em "ninguem faz isso pela UI hoje".
--
-- Mesma filosofia de 0002: bloquear com erro claro, nao apagar/reassociar
-- vinculo silenciosamente — quem for mover um usuario de empresa decide
-- explicitamente o que fazer com as equipes dele primeiro (nesta empresa).
--
-- Pre-condicao: 0001_equipes.sql e 0002_equipes_integridade_empresa.sql
-- aplicadas.
--
-- Concorrencia (limitacao conhecida, documentada em vez de ignorada): o
-- SELECT count(*) abaixo roda em READ COMMITTED (padrao do Postgres) e nao
-- toma lock sobre team_memberships. Uma transacao concorrente inserindo um
-- vinculo pro mesmo usuario, entre este SELECT e o commit desta transacao,
-- pode em teoria escapar da checagem. Nao ha hoje caminho de UI pra isso
-- acontecer (mudanca de company_id e so via SQL direto), e o trigger de
-- 0002 continua bloqueando o INSERT do vinculo em si sempre que ele
-- referenciar uma equipe de empresa diferente da atual do usuario — entao
-- o pior cenario e um vinculo antigo (da empresa de origem) sobreviver, nao
-- um vinculo novo incorreto sendo criado. Se este caminho virar uma
-- operacao real de produto, revisitar com `SELECT ... FOR UPDATE` explicito
-- ou SERIALIZABLE.
create or replace function public.prevent_company_change_with_active_teams()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_vinculos integer;
begin
    if new.company_id = old.company_id then
        return new;
    end if;

    select count(*) into v_vinculos
    from public.team_memberships tm
    join public.teams t on t.id = tm.team_id
    where tm.user_profile_id = old.id
      and t.company_id = old.company_id;

    if v_vinculos > 0 then
        raise exception
            'Usuario % tem % vinculo(s) de equipe na empresa atual — remova-os explicitamente antes de mudar a empresa do usuario.',
            old.id, v_vinculos
            using errcode = 'NS004';
    end if;

    return new;
end;
$$;

comment on function public.prevent_company_change_with_active_teams() is
    'Bloqueia UPDATE de user_profiles.company_id enquanto existirem team_memberships '
    'do usuario numa equipe da empresa atual — evita vinculo orfao apontando pra '
    'equipe de empresa diferente da nova. SQLSTATE customizado NS004.';

drop trigger if exists user_profiles_prevent_company_change_with_teams on public.user_profiles;
create trigger user_profiles_prevent_company_change_with_teams
    before update of company_id
    on public.user_profiles
    for each row
    execute function public.prevent_company_change_with_active_teams();

-- ============================================================
-- 0004_atendimento_chat.sql
-- ============================================================
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

-- ============================================================
-- GRANT necessário para as tabelas novas do chat
-- ============================================================
grant select, insert, update, delete on public.channels, public.contacts, public.contact_phone_numbers, public.conversations, public.conversation_transfers, public.messages, public.message_attachments, public.inbound_events, public.outbound_jobs to authenticated, service_role;

-- ============================================================
-- 0005_atendimento_worker_rpc.sql
-- ============================================================
-- RPC pro worker persistente reivindicar lotes de outbound_jobs de forma
-- atomica (SELECT ... FOR UPDATE SKIP LOCKED) — o PostgREST/supabase-js nao
-- expoe essa clausula de lock diretamente via .from()/.select(), entao isso
-- precisa ser uma function chamada via .rpc(). Sem isso, dois processos de
-- worker (ou reinicios sobrepostos) poderiam pegar o mesmo job.
--
-- So o service_role pode chamar — o worker roda com a chave de servico,
-- nunca com sessao de usuario comum (é processo de backend confiavel, sem
-- contexto de requisicao HTTP/cookie).
--
-- Pre-condicao: 0004_atendimento_chat.sql aplicada.

create or replace function public.claim_outbound_jobs(p_limit integer, p_worker_id text)
returns setof public.outbound_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    update public.outbound_jobs
    set status = 'processando',
        locked_at = now(),
        locked_by = p_worker_id,
        attempts = attempts + 1,
        updated_at = now()
    where id in (
        select id from public.outbound_jobs
        where status = 'pendente'
          and next_attempt_at <= now()
        order by created_at
        limit p_limit
        for update skip locked
    )
    returning *;
end;
$$;

comment on function public.claim_outbound_jobs(integer, text) is
    'Reivindica ate p_limit outbound_jobs pendentes de forma atomica (FOR UPDATE SKIP LOCKED), '
    'marcando-os "processando" e incrementando attempts. So service_role pode chamar.';

revoke all on function public.claim_outbound_jobs(integer, text) from public;
grant execute on function public.claim_outbound_jobs(integer, text) to service_role;
