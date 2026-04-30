-- Execute manualmente no Supabase para habilitar login por username.
-- Mantem o Supabase Auth, mas passa a usar public.user_profiles.username
-- como login visivel do CRM e gera emails tecnicos internos automaticamente.

alter table public.user_profiles
  add column if not exists username text;

with normalized as (
  select
    id,
    trim(both '.' from regexp_replace(
      translate(
        lower(
          coalesce(
            nullif(split_part(email, '@', 1), ''),
            nullif(full_name, ''),
            'usuario'
          )
        ),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9._-]+',
      '.',
      'g'
    )) as base_username
  from public.user_profiles
),
ranked as (
  select
    id,
    case
      when coalesce(base_username, '') = '' then 'usuario-' || substr(replace(id::text, '-', ''), 1, 6)
      when row_number() over (partition by base_username order by id) = 1 then base_username
      else base_username || '-' || substr(replace(id::text, '-', ''), 1, 6)
    end as final_username
  from normalized
)
update public.user_profiles up
set username = ranked.final_username
from ranked
where up.id = ranked.id
  and (up.username is null or btrim(up.username) = '');

alter table public.user_profiles
  alter column username set not null;

create unique index if not exists user_profiles_username_unique_idx
  on public.user_profiles (lower(username));
