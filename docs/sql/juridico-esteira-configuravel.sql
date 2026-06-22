-- Esteira juridica configuravel por empresa.
-- Execute este arquivo completo no SQL Editor do Supabase.

alter table public.user_profiles
  add column if not exists can_edit_legal_workflow boolean not null default false;

create table if not exists public.legal_workflow_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  legacy_key text null,
  title text not null,
  short_title text not null,
  description text not null,
  color text not null default '#0f766e',
  expected_documents text[] not null default '{}'::text[],
  position integer not null,
  created_by uuid null references public.user_profiles(id) on delete set null,
  updated_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  constraint legal_workflow_stages_title_not_blank
    check (length(trim(title)) > 0),
  constraint legal_workflow_stages_short_title_not_blank
    check (length(trim(short_title)) > 0),
  constraint legal_workflow_stages_description_not_blank
    check (length(trim(description)) > 0),
  constraint legal_workflow_stages_position_positive
    check (position > 0)
);

create unique index if not exists legal_workflow_stages_company_legacy_key_idx
  on public.legal_workflow_stages (company_id, legacy_key)
  where legacy_key is not null;

create unique index if not exists legal_workflow_stages_company_title_idx
  on public.legal_workflow_stages (company_id, lower(trim(title)));

create unique index if not exists legal_workflow_stages_company_description_idx
  on public.legal_workflow_stages (company_id, lower(trim(description)));

create index if not exists legal_workflow_stages_company_position_idx
  on public.legal_workflow_stages (company_id, position, created_at);

insert into public.legal_workflow_stages (
  company_id,
  legacy_key,
  title,
  short_title,
  description,
  color,
  expected_documents,
  position
)
select
  company.id,
  defaults.legacy_key,
  defaults.title,
  defaults.short_title,
  defaults.description,
  defaults.color,
  defaults.expected_documents,
  defaults.position
from public.companies company
cross join (
  values
    (
      'termo_pagamento_servico',
      'Termo de pagamento de prestacao de servico',
      'Termo de pagamento',
      'Entrada do cliente no Juridico com o termo comercial de pagamento de prestacao de servico.',
      '#0f766e',
      array['Termo de pagamento de prestacao de servico']::text[],
      1
    ),
    (
      'lgpd_hipossuficiencia_procuracao',
      'LGPD, hipossuficiencia e procuracao',
      'LGPD e procuracao',
      'Reunir e emitir os documentos de consentimento, hipossuficiencia e procuracao ad judicia.',
      '#0369a1',
      array['Termo LGPD', 'Declaracao de Hipossuficiencia', 'Procuracao Ad Judicia']::text[],
      2
    ),
    (
      'diligencia_cobranca',
      'Diligencia para cobranca',
      'Diligencia e cobranca',
      'Emitir os documentos de diligencia e formalizacao da cobranca extrajudicial.',
      '#7c3aed',
      array['Notificacao Extrajudicial', 'Protocolo de Formalizacao', 'Comunicado de Designacao de Perito']::text[],
      3
    ),
    (
      'pagamento_laudo',
      'Pagamento de laudo',
      'Pagamento de laudo',
      'Controlar o documento da etapa em que o cliente realiza o pagamento do laudo.',
      '#b45309',
      array['Termo de Pagamento de Laudo']::text[],
      4
    ),
    (
      'pos_laudo_ciencia',
      'Pos recebimento do laudo',
      'Pos-laudo',
      'Registrar a etapa final de ciencia e responsabilidade apos o recebimento do laudo.',
      '#be123c',
      array['Termo de Ciencia e Responsabilidade']::text[],
      5
    )
) as defaults(
  legacy_key,
  title,
  short_title,
  description,
  color,
  expected_documents,
  position
)
on conflict (company_id, legacy_key) where legacy_key is not null do nothing;

create or replace function public.seed_default_legal_workflow_stages()
returns trigger
language plpgsql
as $$
begin
  insert into public.legal_workflow_stages (
    company_id,
    legacy_key,
    title,
    short_title,
    description,
    color,
    expected_documents,
    position
  )
  values
    (
      new.id,
      'termo_pagamento_servico',
      'Termo de pagamento de prestacao de servico',
      'Termo de pagamento',
      'Entrada do cliente no Juridico com o termo comercial de pagamento de prestacao de servico.',
      '#0f766e',
      array['Termo de pagamento de prestacao de servico']::text[],
      1
    ),
    (
      new.id,
      'lgpd_hipossuficiencia_procuracao',
      'LGPD, hipossuficiencia e procuracao',
      'LGPD e procuracao',
      'Reunir e emitir os documentos de consentimento, hipossuficiencia e procuracao ad judicia.',
      '#0369a1',
      array['Termo LGPD', 'Declaracao de Hipossuficiencia', 'Procuracao Ad Judicia']::text[],
      2
    ),
    (
      new.id,
      'diligencia_cobranca',
      'Diligencia para cobranca',
      'Diligencia e cobranca',
      'Emitir os documentos de diligencia e formalizacao da cobranca extrajudicial.',
      '#7c3aed',
      array['Notificacao Extrajudicial', 'Protocolo de Formalizacao', 'Comunicado de Designacao de Perito']::text[],
      3
    ),
    (
      new.id,
      'pagamento_laudo',
      'Pagamento de laudo',
      'Pagamento de laudo',
      'Controlar o documento da etapa em que o cliente realiza o pagamento do laudo.',
      '#b45309',
      array['Termo de Pagamento de Laudo']::text[],
      4
    ),
    (
      new.id,
      'pos_laudo_ciencia',
      'Pos recebimento do laudo',
      'Pos-laudo',
      'Registrar a etapa final de ciencia e responsabilidade apos o recebimento do laudo.',
      '#be123c',
      array['Termo de Ciencia e Responsabilidade']::text[],
      5
    )
  on conflict (company_id, legacy_key) where legacy_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists companies_seed_default_legal_workflow_trigger
  on public.companies;

create trigger companies_seed_default_legal_workflow_trigger
after insert on public.companies
for each row execute function public.seed_default_legal_workflow_stages();

alter table public.pre_sales
  add column if not exists legal_stage_id uuid null;

alter table public.document_templates
  add column if not exists legal_stage_id uuid null;

alter table public.email_templates
  add column if not exists legal_stage_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pre_sales_legal_stage_id_fkey'
  ) then
    alter table public.pre_sales
      add constraint pre_sales_legal_stage_id_fkey
      foreign key (legal_stage_id)
      references public.legal_workflow_stages(id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'document_templates_legal_stage_id_fkey'
  ) then
    alter table public.document_templates
      add constraint document_templates_legal_stage_id_fkey
      foreign key (legal_stage_id)
      references public.legal_workflow_stages(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'email_templates_legal_stage_id_fkey'
  ) then
    alter table public.email_templates
      add constraint email_templates_legal_stage_id_fkey
      foreign key (legal_stage_id)
      references public.legal_workflow_stages(id)
      on delete set null;
  end if;
end $$;

update public.pre_sales pre_sale
set legal_stage_id = stage.id
from public.legal_workflow_stages stage
where pre_sale.company_id = stage.company_id
  and pre_sale.legal_stage = stage.legacy_key
  and pre_sale.legal_stage_id is null;

update public.document_templates template
set legal_stage_id = stage.id
from public.legal_workflow_stages stage
where template.company_id = stage.company_id
  and template.legal_stage = stage.legacy_key
  and template.legal_stage_id is null;

update public.email_templates template
set legal_stage_id = stage.id
from public.legal_workflow_stages stage
where template.company_id = stage.company_id
  and template.legal_stage = stage.legacy_key
  and template.legal_stage_id is null;

create index if not exists pre_sales_company_legal_stage_id_idx
  on public.pre_sales (company_id, legal_stage_id, legal_stage_updated_at);

create index if not exists document_templates_company_legal_stage_id_idx
  on public.document_templates (company_id, legal_stage_id);

create index if not exists email_templates_company_legal_stage_id_idx
  on public.email_templates (company_id, legal_stage_id);

create table if not exists public.legal_workflow_bulk_moves (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  target_stage_id uuid not null references public.legal_workflow_stages(id) on delete restrict,
  note text not null,
  moved_count integer not null default 0,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  undo_expires_at timestamptz not null default (now() + interval '10 minutes'),
  undone_at timestamptz null,
  undone_by uuid null references public.user_profiles(id) on delete set null,
  constraint legal_workflow_bulk_moves_note_not_blank
    check (length(trim(note)) > 0)
);

create table if not exists public.legal_workflow_bulk_move_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bulk_move_id uuid not null references public.legal_workflow_bulk_moves(id) on delete cascade,
  pre_sale_id uuid not null references public.pre_sales(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  previous_stage_id uuid not null references public.legal_workflow_stages(id) on delete restrict,
  target_stage_id uuid not null references public.legal_workflow_stages(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (bulk_move_id, pre_sale_id)
);

create index if not exists legal_workflow_bulk_moves_company_created_at_idx
  on public.legal_workflow_bulk_moves (company_id, created_at desc);

create index if not exists legal_workflow_bulk_move_items_batch_idx
  on public.legal_workflow_bulk_move_items (company_id, bulk_move_id);

create or replace function public.limit_legal_workflow_stages()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.legal_workflow_stages
    where company_id = new.company_id
  ) >= 20 then
    raise exception 'A esteira juridica aceita no maximo 20 colunas.';
  end if;

  return new;
end;
$$;

drop trigger if exists legal_workflow_stages_limit_trigger
  on public.legal_workflow_stages;

create trigger legal_workflow_stages_limit_trigger
before insert on public.legal_workflow_stages
for each row execute function public.limit_legal_workflow_stages();

create or replace function public.assign_first_legal_workflow_stage()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'aprovado' and new.legal_stage_id is null then
    select stage.id, stage.legacy_key
    into new.legal_stage_id, new.legal_stage
    from public.legal_workflow_stages stage
    where stage.company_id = new.company_id
    order by stage.position, stage.created_at
    limit 1;

    new.legal_stage_updated_at = coalesce(new.legal_stage_updated_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists pre_sales_assign_first_legal_stage_trigger
  on public.pre_sales;

create trigger pre_sales_assign_first_legal_stage_trigger
before insert or update of status on public.pre_sales
for each row execute function public.assign_first_legal_workflow_stage();

alter table public.legal_workflow_stages enable row level security;
alter table public.legal_workflow_bulk_moves enable row level security;
alter table public.legal_workflow_bulk_move_items enable row level security;

drop policy if exists legal_workflow_stages_select_company
  on public.legal_workflow_stages;
create policy legal_workflow_stages_select_company
  on public.legal_workflow_stages
  for select
  using (company_id = public.current_user_company_id());

drop policy if exists legal_workflow_stages_manage_editors
  on public.legal_workflow_stages;
create policy legal_workflow_stages_manage_editors
  on public.legal_workflow_stages
  for all
  using (
    company_id = public.current_user_company_id()
    and exists (
      select 1
      from public.user_profiles profile
      where profile.auth_user_id = auth.uid()
        and profile.company_id = legal_workflow_stages.company_id
        and profile.is_active
        and (
          profile.role = 'admin'
          or profile.can_edit_legal_workflow
        )
    )
  )
  with check (
    company_id = public.current_user_company_id()
    and exists (
      select 1
      from public.user_profiles profile
      where profile.auth_user_id = auth.uid()
        and profile.company_id = legal_workflow_stages.company_id
        and profile.is_active
        and (
          profile.role = 'admin'
          or profile.can_edit_legal_workflow
        )
    )
  );

drop policy if exists legal_workflow_bulk_moves_manage_editors
  on public.legal_workflow_bulk_moves;
create policy legal_workflow_bulk_moves_manage_editors
  on public.legal_workflow_bulk_moves
  for all
  using (
    company_id = public.current_user_company_id()
    and exists (
      select 1
      from public.user_profiles profile
      where profile.auth_user_id = auth.uid()
        and profile.company_id = legal_workflow_bulk_moves.company_id
        and profile.is_active
        and (
          profile.role = 'admin'
          or profile.can_edit_legal_workflow
        )
    )
  )
  with check (
    company_id = public.current_user_company_id()
    and exists (
      select 1
      from public.user_profiles profile
      where profile.auth_user_id = auth.uid()
        and profile.company_id = legal_workflow_bulk_moves.company_id
        and profile.is_active
        and (
          profile.role = 'admin'
          or profile.can_edit_legal_workflow
        )
    )
  );

drop policy if exists legal_workflow_bulk_move_items_manage_editors
  on public.legal_workflow_bulk_move_items;
create policy legal_workflow_bulk_move_items_manage_editors
  on public.legal_workflow_bulk_move_items
  for all
  using (
    company_id = public.current_user_company_id()
    and exists (
      select 1
      from public.user_profiles profile
      where profile.auth_user_id = auth.uid()
        and profile.company_id = legal_workflow_bulk_move_items.company_id
        and profile.is_active
        and (
          profile.role = 'admin'
          or profile.can_edit_legal_workflow
        )
    )
  )
  with check (
    company_id = public.current_user_company_id()
    and exists (
      select 1
      from public.user_profiles profile
      where profile.auth_user_id = auth.uid()
        and profile.company_id = legal_workflow_bulk_move_items.company_id
        and profile.is_active
        and (
          profile.role = 'admin'
          or profile.can_edit_legal_workflow
        )
    )
  );

grant select on public.legal_workflow_stages to authenticated;
grant insert, update, delete on public.legal_workflow_stages to authenticated;
grant select, insert, update on public.legal_workflow_bulk_moves to authenticated;
grant select, insert, update, delete on public.legal_workflow_bulk_move_items to authenticated;
