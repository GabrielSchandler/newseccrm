-- Aprovação centralizada das informações publicadas no portal do cliente.
-- Script idempotente: pode ser executado novamente sem duplicar estruturas.

alter table public.client_tracking_updates
  add column if not exists approval_status text not null default 'not_requested',
  add column if not exists approval_requested_by uuid null references public.user_profiles(id) on delete set null,
  add column if not exists approval_requested_at timestamptz null,
  add column if not exists approval_reviewed_by uuid null references public.user_profiles(id) on delete set null,
  add column if not exists approval_reviewed_at timestamptz null,
  add column if not exists approval_review_note text null;

alter table public.client_documents
  add column if not exists client_visibility_requested boolean not null default false,
  add column if not exists client_download_requested boolean not null default false,
  add column if not exists client_access_status text not null default 'not_requested',
  add column if not exists client_access_requested_by uuid null references public.user_profiles(id) on delete set null,
  add column if not exists client_access_requested_at timestamptz null,
  add column if not exists client_access_reviewed_by uuid null references public.user_profiles(id) on delete set null,
  add column if not exists client_access_reviewed_at timestamptz null,
  add column if not exists client_access_review_note text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'client_tracking_updates_approval_status_check'
      and conrelid = 'public.client_tracking_updates'::regclass
  ) then
    alter table public.client_tracking_updates
      add constraint client_tracking_updates_approval_status_check
      check (approval_status in ('not_requested', 'pending', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'client_documents_client_access_status_check'
      and conrelid = 'public.client_documents'::regclass
  ) then
    alter table public.client_documents
      add constraint client_documents_client_access_status_check
      check (client_access_status in ('not_requested', 'pending', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'client_documents_download_requires_visibility_check'
      and conrelid = 'public.client_documents'::regclass
  ) then
    alter table public.client_documents
      add constraint client_documents_download_requires_visibility_check
      check (not client_download_requested or client_visibility_requested);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'client_tracking_updates_approved_requires_visibility_check'
      and conrelid = 'public.client_tracking_updates'::regclass
  ) then
    alter table public.client_tracking_updates
      add constraint client_tracking_updates_approved_requires_visibility_check
      check (approval_status <> 'approved' or visible_to_client);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'client_documents_approved_access_check'
      and conrelid = 'public.client_documents'::regclass
  ) then
    alter table public.client_documents
      add constraint client_documents_approved_access_check
      check (
        client_access_status <> 'approved'
        or (
          document_type = 'extrajudicial'
          and client_visibility_requested
          and pre_sale_id is not null
        )
      );
  end if;
end
$$;

-- Todo acompanhamento que estava público passa a aguardar aprovação da Gestão.
update public.client_tracking_updates
set
  approval_status = 'pending',
  approval_requested_by = coalesce(approval_requested_by, created_by),
  approval_requested_at = coalesce(approval_requested_at, created_at)
where visible_to_client = true
  and approval_status = 'not_requested';

create index if not exists client_tracking_updates_approval_queue_idx
  on public.client_tracking_updates (company_id, approval_status, approval_requested_at, created_at)
  where deleted_at is null;

create index if not exists client_documents_access_approval_queue_idx
  on public.client_documents (company_id, client_access_status, client_access_requested_at, created_at)
  where deleted_at is null and document_type = 'extrajudicial';

create index if not exists client_documents_public_tracking_idx
  on public.client_documents (company_id, client_id, pre_sale_id, client_access_status, created_at desc)
  where deleted_at is null and document_type = 'extrajudicial';

create or replace function public.protect_client_portal_approval_decisions()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  is_privileged boolean :=
    coalesce(auth.role() = 'service_role', false)
    or coalesce(public.current_user_is_admin_or_manager(), false);
begin
  if is_privileged then
    return new;
  end if;

  if tg_table_name = 'client_tracking_updates' then
    if new.approval_status in ('approved', 'rejected')
      or new.approval_reviewed_by is not null
      or new.approval_reviewed_at is not null
      or new.approval_review_note is not null then
      raise exception 'Somente a Gestão pode decidir a publicação no portal do cliente.';
    end if;

    if tg_op = 'UPDATE'
      and old.approval_status = 'approved'
      and new.approval_status = 'approved'
      and (
        new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.status is distinct from old.status
        or new.event_at is distinct from old.event_at
        or new.visible_to_client is distinct from old.visible_to_client
      ) then
      raise exception 'Uma publicação aprovada deve voltar para análise antes de ser alterada.';
    end if;
  elsif tg_table_name = 'client_documents' then
    if new.client_access_status in ('approved', 'rejected')
      or new.client_access_reviewed_by is not null
      or new.client_access_reviewed_at is not null
      or new.client_access_review_note is not null then
      raise exception 'Somente a Gestão pode decidir o acesso do cliente ao documento.';
    end if;

    if tg_op = 'UPDATE'
      and old.client_access_status = 'approved'
      and new.client_access_status = 'approved'
      and (
        new.document_type is distinct from old.document_type
        or new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.file_path is distinct from old.file_path
        or new.pre_sale_id is distinct from old.pre_sale_id
        or new.client_visibility_requested is distinct from old.client_visibility_requested
        or new.client_download_requested is distinct from old.client_download_requested
      ) then
      raise exception 'Um documento aprovado deve voltar para análise antes de ser alterado.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_client_tracking_approval_decisions
  on public.client_tracking_updates;
create trigger protect_client_tracking_approval_decisions
before insert or update on public.client_tracking_updates
for each row execute function public.protect_client_portal_approval_decisions();

drop trigger if exists protect_client_document_approval_decisions
  on public.client_documents;
create trigger protect_client_document_approval_decisions
before insert or update on public.client_documents
for each row execute function public.protect_client_portal_approval_decisions();

comment on column public.client_tracking_updates.approval_status is
  'Fluxo de aprovação da publicação: not_requested, pending, approved ou rejected.';
comment on column public.client_documents.client_visibility_requested is
  'Quando aprovado, permite ao cliente saber que o documento extrajudicial existe.';
comment on column public.client_documents.client_download_requested is
  'Quando aprovado, permite baixar o arquivo pelo portal do cliente.';
