-- Alinhamento manual entre banco e codigo atual do CRM.
-- Nao altera login, autenticacao, Supabase Auth nem RLS existente.

-- =========================================================
-- DOCUMENTOS OFICIAIS
-- =========================================================

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

-- =========================================================
-- DADOS DA EMPRESA PARA DOCUMENTOS
-- =========================================================

alter table public.companies
  add column if not exists legal_name text,
  add column if not exists trade_name text;

-- =========================================================
-- STORAGE PRIVADO
-- =========================================================

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('client-documents', 'client-documents', false),
  ('calculation-reports', 'calculation-reports', false)
on conflict (id) do nothing;

-- IMPORTANTE:
-- Revise manualmente as policies de Storage para os buckets privados acima,
-- respeitando o modelo multiempresa da sua instancia.
