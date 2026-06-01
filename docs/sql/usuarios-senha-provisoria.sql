-- Adiciona campo para armazenar a ultima senha provisoria definida por admin/gerente.
-- Este campo e preenchido quando admin/gerente define ou reseta a senha de um usuario.
-- E apagado automaticamente quando o usuario troca a propria senha via /alterar-senha.
-- Visivel apenas para administradores e gerentes na tela de edicao do usuario.

alter table public.user_profiles
  add column if not exists last_set_password text;
