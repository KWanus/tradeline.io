-- Tradeline operator-OS — initial schema (PLAN P0-2)
--
-- Mirrors the browser localStorage stores so the backend can take over without
-- changing the shape of the data the app already reads/writes. Each store is a
-- table of user-scoped rows carrying a JSONB `data` payload (the same object
-- the localStorage helpers serialize today) plus bookkeeping columns. Singleton
-- stores (capital, approval state, inbox-seen) hold one row per user.
--
-- Every table has Row Level Security enabled with `user_id = auth.uid()` on all
-- four verbs, so a signed-in user can only ever touch their own rows. The
-- service-role key (server-only) bypasses RLS for trusted server code.
--
-- Apply with:  supabase db push     (or paste into the SQL editor)

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Per-store table factory (run inline below for each store)
-- ---------------------------------------------------------------------------
do $$
declare
  -- Collection stores: many rows per user, keyed by their own app id.
  collection_tables text[] := array[
    'customers',
    'pipeline_deals',
    'portfolio_holdings',
    'compliance_licenses',
    'contacts',
    'bank_contacts',
    'closings',
    'collections',
    'deal_events',
    'replies',
    'do_not_contact'
  ];
  -- Singleton stores: exactly one row per user.
  singleton_tables text[] := array[
    'capital_config',
    'approval_state',
    'inbox_seen'
  ];
  t text;
begin
  foreach t in array collection_tables loop
    execute format($f$
      create table if not exists public.%I (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id) on delete cascade,
        app_id text,                       -- the store's own id (deal id, etc.)
        data jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (user_id, app_id)
      );
    $f$, t);
  end loop;

  foreach t in array singleton_tables loop
    execute format($f$
      create table if not exists public.%I (
        user_id uuid primary key references auth.users(id) on delete cascade,
        data jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS + policies + updated_at triggers + indexes for every table
-- ---------------------------------------------------------------------------
do $$
declare
  all_tables text[] := array[
    'customers','pipeline_deals','portfolio_holdings','compliance_licenses',
    'contacts','bank_contacts','closings','collections','deal_events',
    'replies','do_not_contact','capital_config','approval_state','inbox_seen'
  ];
  t text;
begin
  foreach t in array all_tables loop
    execute format('alter table public.%I enable row level security;', t);

    execute format($p$
      drop policy if exists %1$s_select on public.%1$I;
      create policy %1$s_select on public.%1$I
        for select using (user_id = auth.uid());
    $p$, t);

    execute format($p$
      drop policy if exists %1$s_insert on public.%1$I;
      create policy %1$s_insert on public.%1$I
        for insert with check (user_id = auth.uid());
    $p$, t);

    execute format($p$
      drop policy if exists %1$s_update on public.%1$I;
      create policy %1$s_update on public.%1$I
        for update using (user_id = auth.uid()) with check (user_id = auth.uid());
    $p$, t);

    execute format($p$
      drop policy if exists %1$s_delete on public.%1$I;
      create policy %1$s_delete on public.%1$I
        for delete using (user_id = auth.uid());
    $p$, t);

    execute format($t$
      drop trigger if exists %1$s_set_updated_at on public.%1$I;
      create trigger %1$s_set_updated_at before update on public.%1$I
        for each row execute function public.set_updated_at();
    $t$, t);

    execute format(
      'create index if not exists %1$s_user_id_idx on public.%1$I (user_id);',
      t
    );
  end loop;
end $$;
