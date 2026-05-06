alter table public.pre_sales
  add column if not exists legal_stage text,
  add column if not exists legal_stage_updated_at timestamptz;

update public.pre_sales
set
  legal_stage = coalesce(legal_stage, 'termo_pagamento_servico'),
  legal_stage_updated_at = coalesce(legal_stage_updated_at, updated_at, created_at)
where status = 'aprovado'
  and legal_stage is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pre_sales_legal_stage_check'
  ) then
    alter table public.pre_sales
      add constraint pre_sales_legal_stage_check
      check (
        legal_stage is null
        or legal_stage in (
          'termo_pagamento_servico',
          'lgpd_hipossuficiencia_procuracao',
          'diligencia_cobranca',
          'pagamento_laudo',
          'pos_laudo_ciencia'
        )
      );
  end if;
end $$;

alter table public.document_templates
  add column if not exists legal_stage text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_templates_legal_stage_check'
  ) then
    alter table public.document_templates
      add constraint document_templates_legal_stage_check
      check (
        legal_stage is null
        or legal_stage in (
          'termo_pagamento_servico',
          'lgpd_hipossuficiencia_procuracao',
          'diligencia_cobranca',
          'pagamento_laudo',
          'pos_laudo_ciencia'
        )
      );
  end if;
end $$;
