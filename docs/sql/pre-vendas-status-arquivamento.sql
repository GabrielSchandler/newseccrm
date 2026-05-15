do $$
declare
  status_udt_schema text;
  status_udt_name text;
  status_is_enum boolean;
  constraint_record record;
begin
  select columns.udt_schema, columns.udt_name
    into status_udt_schema, status_udt_name
  from information_schema.columns
  where columns.table_schema = 'public'
    and columns.table_name = 'pre_sales'
    and columns.column_name = 'status';

  if status_udt_name is null then
    raise exception 'Coluna public.pre_sales.status nao encontrada.';
  end if;

  select exists (
    select 1
    from pg_type
    join pg_namespace on pg_namespace.oid = pg_type.typnamespace
    where typname = status_udt_name
      and pg_namespace.nspname = status_udt_schema
      and typtype = 'e'
  ) into status_is_enum;

  if status_is_enum then
    execute format(
      'alter type %I.%I add value if not exists %L',
      status_udt_schema,
      status_udt_name,
      'inativo'
    );
    execute format(
      'alter type %I.%I add value if not exists %L',
      status_udt_schema,
      status_udt_name,
      'distrato'
    );
  else
    for constraint_record in
      select conname
      from pg_constraint
      where conrelid = 'public.pre_sales'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%status%'
        and pg_get_constraintdef(oid) ilike '%aprovado%'
        and pg_get_constraintdef(oid) ilike '%perdido%'
    loop
      execute format('alter table public.pre_sales drop constraint %I', constraint_record.conname);
    end loop;

    alter table public.pre_sales
      add constraint pre_sales_status_check
      check (
        status in (
          'lead',
          'pre_venda',
          'em_contato',
          'em_negociacao',
          'aprovado',
          'perdido',
          'inativo',
          'distrato'
        )
      );
  end if;
end $$;
