-- Execute este SQL manualmente no Supabase antes de usar a geracao oficial por DOCX.
-- Ele nao altera login, autenticacao, Supabase Auth nem as politicas RLS existentes.

alter table public.document_templates
  add column if not exists original_docx_path text,
  add column if not exists original_docx_filename text,
  add column if not exists original_docx_size bigint,
  add column if not exists original_docx_uploaded_at timestamptz,
  add column if not exists original_pdf_path text,
  add column if not exists original_pdf_filename text,
  add column if not exists original_pdf_size bigint,
  add column if not exists original_pdf_uploaded_at timestamptz;

alter table public.generated_documents
  add column if not exists generated_docx_path text,
  add column if not exists generated_pdf_path text,
  add column if not exists generated_docx_filename text,
  add column if not exists generated_pdf_filename text,
  add column if not exists render_source text default 'html',
  add column if not exists pdf_error_message text;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- IMPORTANTE:
-- O bucket "documents" precisa ter politicas de Storage compativeis com o modelo
-- multiempresa do projeto. Como as regras de RLS variam por instalacao, revise as
-- politicas antes de liberar em producao.
