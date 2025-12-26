alter table public.workspaces
  add column if not exists external_key text;

create unique index if not exists workspaces_external_key_key on public.workspaces (external_key);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tx_status_check') then
    alter table public.transactions
      add constraint tx_status_check check (status in ('pending', 'paid'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tx_payment_method_check') then
    alter table public.transactions
      add constraint tx_payment_method_check check (payment_method in ('pix', 'debit', 'cash', 'credit', 'transfer'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tx_kind_check') then
    alter table public.transactions
      add constraint tx_kind_check check (kind in ('income', 'expense', 'fee_interest', 'debt_payment', 'transfer'));
  end if;
end $$;

create index if not exists tx_ws_competence_idx
  on public.transactions (workspace_id, competence_month)
  where deleted_at is null;

create index if not exists tx_ws_occurred_idx
  on public.transactions (workspace_id, occurred_at)
  where deleted_at is null;

create index if not exists tx_ws_card_idx
  on public.transactions (workspace_id, card_id)
  where deleted_at is null;

create index if not exists tx_ws_category_idx
  on public.transactions (workspace_id, category_id)
  where deleted_at is null;

create index if not exists tx_ws_kind_idx
  on public.transactions (workspace_id, kind)
  where deleted_at is null;

create index if not exists tx_ws_deleted_idx
  on public.transactions (workspace_id, deleted_at);

create extension if not exists pg_trgm;

create index if not exists tx_desc_trgm_idx
  on public.transactions using gin (description gin_trgm_ops);

create index if not exists tx_person_trgm_idx
  on public.transactions using gin (person gin_trgm_ops);
