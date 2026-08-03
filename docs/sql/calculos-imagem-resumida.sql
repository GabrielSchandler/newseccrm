alter table public.financing_calculations
  add column if not exists summary_image_storage_path text,
  add column if not exists summary_image_file_name text;

update storage.buckets
set allowed_mime_types = array(
  select distinct mime_type
  from unnest(
    coalesce(allowed_mime_types, array[]::text[])
    || array['application/pdf', 'image/png']::text[]
  ) as mime_type
)
where id = 'calculation-reports';

comment on column public.financing_calculations.summary_image_storage_path is
  'Caminho privado da imagem resumida da simulação no bucket calculation-reports.';

comment on column public.financing_calculations.summary_image_file_name is
  'Nome de download da imagem resumida da simulação.';
