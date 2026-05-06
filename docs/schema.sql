-- Tradeline canonical schema
-- Target: Supabase / Postgres 15+
-- Status: design draft — not yet provisioned. Local pipeline writes JSON.
-- Constraints honored:
--   * No consumer PII columns. Anywhere.
--   * All "subject" rows are originators or portfolios, never persons.
--   * Customer-uploaded tapes live in customer_tapes with strict RLS, never joined to public tables.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- originators: banks, lenders, issuers we track via public sources
-- ---------------------------------------------------------------------------
create table if not exists originators (
  id              uuid primary key default gen_random_uuid(),
  ticker          text unique,                  -- public ticker, when applicable
  cik             text unique,                  -- SEC Central Index Key
  legal_name      text not null,
  tier            text check (tier in ('GSIB','super-regional','regional','community','non-bank','specialty')),
  asset_class_focus text,                       -- 'multi' | 'credit-card' | 'auto' | 'medical' | …
  ir_url          text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists originators_tier_idx on originators(tier);

-- ---------------------------------------------------------------------------
-- filings: SEC documents we have ingested (10-Q, 10-K, 8-K, S-1, etc.)
-- ---------------------------------------------------------------------------
create table if not exists filings (
  id              uuid primary key default gen_random_uuid(),
  originator_id   uuid not null references originators(id) on delete cascade,
  source          text not null check (source in ('sec_edgar','courtlistener','news','ir')),
  source_id       text not null,                -- accession number / story id / etc
  form_type       text,                         -- '10-Q','10-K','8-K',…
  filed_at        timestamptz not null,
  period_of_report date,
  url             text not null,
  raw_excerpt     text,                         -- the matched paragraph / lede
  ingested_at     timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists filings_originator_filed_idx on filings(originator_id, filed_at desc);

-- ---------------------------------------------------------------------------
-- signals: extracted, scored events that may indicate divestiture / NPL action
-- ---------------------------------------------------------------------------
create table if not exists signals (
  id              uuid primary key default gen_random_uuid(),
  filing_id       uuid references filings(id) on delete cascade,
  originator_id   uuid not null references originators(id) on delete cascade,
  signal_type     text not null check (signal_type in (
                    'charge_off_increase',
                    'npl_ratio_increase',
                    'portfolio_sale_announced',
                    'divestiture_announced',
                    'reserve_build',
                    'guidance_change',
                    'unspecified'
                  )),
  asset_class     text,
  face_value_usd  numeric(20,2),
  detected_at     timestamptz not null default now(),
  confidence      numeric(3,2) check (confidence between 0 and 1),
  excerpt         text,
  metadata        jsonb default '{}'::jsonb
);

create index if not exists signals_originator_detected_idx on signals(originator_id, detected_at desc);
create index if not exists signals_type_idx on signals(signal_type);

-- ---------------------------------------------------------------------------
-- deals: a normalized record of an actual portfolio that appears available
-- ---------------------------------------------------------------------------
create table if not exists deals (
  id              uuid primary key default gen_random_uuid(),
  originator_id   uuid references originators(id),
  source_signal_id uuid references signals(id),
  asset_class     text not null,
  face_value_usd  numeric(20,2),
  ask_cents_per_dollar numeric(6,3),            -- e.g. 2.700 = 2.7¢
  vintage_months  int,
  region          text,
  posted_at       timestamptz not null default now(),
  status          text not null default 'open' check (status in ('open','withdrawn','closed','expired')),
  notes           text
);

-- ---------------------------------------------------------------------------
-- customers + uploaded tapes — RLS strict; never joined publicly
-- ---------------------------------------------------------------------------
create table if not exists customers (
  id              uuid primary key default gen_random_uuid(),
  org_name        text not null,
  primary_email   text not null,
  licensed_states text[] not null default '{}', -- attestation collected at signup
  plan            text not null default 'design_partner',
  created_at      timestamptz not null default now()
);

create table if not exists customer_tapes (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id) on delete cascade,
  uploaded_at     timestamptz not null default now(),
  storage_object  text not null,                -- Supabase Storage object key
  asset_class     text,
  face_value_usd  numeric(20,2),
  account_count   int,
  -- IMPORTANT: no PII columns here. Tape rows live ONLY in Supabase Storage,
  -- behind a customer-scoped key, never indexed into Postgres.
  score_json      jsonb,                        -- portfolio-level only
  notes           text
);

-- Row-Level Security stubs (enable in Supabase via UI or migration on provisioning)
-- alter table customer_tapes enable row level security;
-- create policy "tape owner" on customer_tapes for all
--   using (customer_id = auth.uid());
