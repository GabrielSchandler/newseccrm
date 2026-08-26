-- DEPRECATED: passwords must never be stored in a recoverable database column.
-- This file is intentionally safe to rerun and removes the legacy field.

alter table public.user_profiles
  drop column if exists last_set_password;
