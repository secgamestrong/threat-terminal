create table if not exists public.research_answers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  study_version text not null,
  participant_id uuid not null,
  card_id text not null,
  technique text not null,
  guess text not null check (guess in ('phishing', 'legitimate')),
  correct boolean not null,
  confidence smallint not null check (confidence between 1 and 5),
  response_ms integer not null check (response_ms between 0 and 900000),
  inspected_forensics boolean not null,
  background text check (background in ('security', 'it', 'student', 'other'))
);

create index if not exists research_answers_created_at_idx on public.research_answers (created_at desc);
create index if not exists research_answers_technique_idx on public.research_answers (technique, correct);

alter table public.research_answers enable row level security;
revoke all on table public.research_answers from anon, authenticated;
grant insert, select on table public.research_answers to service_role;

comment on table public.research_answers is
  'Opt-in pseudonymous study events. Do not add names, email addresses, message contents, IP addresses, or free-text profile fields.';

