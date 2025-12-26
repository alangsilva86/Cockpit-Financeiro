create extension if not exists "pgcrypto";

alter table public.app_states
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists schema_version int not null default 1,
  add column if not exists revision bigint not null default 0;

create index if not exists app_states_updated_at_idx on public.app_states(updated_at desc);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'default',
  owner_user_id uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.cards (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  brand text null,
  limit_amount numeric null,
  closing_day int null,
  due_day int null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_workspace_idx on public.cards(workspace_id);

create table if not exists public.categories (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  kind text null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_workspace_idx on public.categories(workspace_id);

create table if not exists public.installment_plans (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  card_id uuid null references public.cards(id) on delete set null,
  description text null,
  total_amount numeric not null,
  installment_count int not null,
  start_competence_month date not null,
  canceled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists installment_plans_workspace_idx on public.installment_plans(workspace_id);
create index if not exists installment_plans_card_idx on public.installment_plans(card_id);

create table if not exists public.transactions (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null,
  amount numeric not null,
  occurred_at date not null,
  competence_month date not null,
  status text not null default 'pending',
  person text null,
  description text null,
  category_id uuid null references public.categories(id) on delete set null,
  payment_method text not null,
  card_id uuid null references public.cards(id) on delete set null,
  installment_plan_id uuid null references public.installment_plans(id) on delete set null,
  installment_index int null,
  installment_count int null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists tx_workspace_competence_idx on public.transactions(workspace_id, competence_month);
create index if not exists tx_workspace_occurred_idx on public.transactions(workspace_id, occurred_at);
create index if not exists tx_workspace_kind_idx on public.transactions(workspace_id, kind);
create index if not exists tx_workspace_card_idx on public.transactions(workspace_id, card_id);
create index if not exists tx_workspace_category_idx on public.transactions(workspace_id, category_id);
create index if not exists tx_workspace_deleted_idx on public.transactions(workspace_id, deleted_at);

create table if not exists public.audit_events (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid null,
  action text not null,
  before jsonb null,
  after jsonb null,
  actor_user_id uuid null,
  actor_device_id text null,
  created_at timestamptz not null default now()
);

create index if not exists audit_workspace_created_idx on public.audit_events(workspace_id, created_at desc);
create index if not exists audit_entity_idx on public.audit_events(entity_type, entity_id);

create or replace view public.v_monthly_summary as
select
  workspace_id,
  competence_month,
  sum(case when kind = 'income' and deleted_at is null then amount else 0 end) as income_total,
  sum(case when kind in ('expense', 'fee_interest') and deleted_at is null then amount else 0 end) as spend_total,
  sum(case when kind = 'fee_interest' and deleted_at is null then amount else 0 end) as interest_total,
  (
    sum(case when kind = 'income' and deleted_at is null then amount else 0 end)
    - sum(case when kind in ('expense', 'fee_interest') and deleted_at is null then amount else 0 end)
  ) as net_total
from public.transactions
group by workspace_id, competence_month;

create or replace view public.v_category_breakdown as
select
  t.workspace_id,
  t.competence_month,
  t.category_id,
  c.name as category_name,
  sum(t.amount) as total
from public.transactions t
left join public.categories c on c.id = t.category_id
where t.deleted_at is null
  and t.kind in ('expense', 'fee_interest')
group by t.workspace_id, t.competence_month, t.category_id, c.name;

create or replace view public.v_card_statement as
select
  workspace_id,
  competence_month,
  card_id,
  sum(
    case
      when payment_method = 'credit'
        and kind in ('expense', 'fee_interest')
        and deleted_at is null
      then amount
      else 0
    end
  ) as charges_competence,
  sum(case when kind = 'debt_payment' and deleted_at is null then amount else 0 end) as payments_cash
from public.transactions
group by workspace_id, competence_month, card_id;
