create table if not exists public.app_states (
  workspace_id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
