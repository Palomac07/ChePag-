alter table public.grupos
add column if not exists ranking_activo boolean not null default true;
