-- Categorias macro para documentos anexados ao cadastro do cliente.
-- Execute no SQL Editor do Supabase antes de usar os novos tipos em produção.

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'client_documents'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%document_type%'
  loop
    execute format(
      'alter table public.client_documents drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;
end $$;

alter table public.client_documents
  alter column document_type drop default;

alter table public.client_documents
  alter column document_type type text using coalesce(document_type::text, 'documentacao');

update public.client_documents
set document_type = 'documentacao',
    updated_at = coalesce(updated_at, now())
where document_type is null
   or document_type not in ('documentacao', 'extrajudicial', 'processual');

alter table public.client_documents
  alter column document_type set default 'documentacao';

alter table public.client_documents
  add constraint client_documents_document_type_check
  check (document_type in ('documentacao', 'extrajudicial', 'processual'));
