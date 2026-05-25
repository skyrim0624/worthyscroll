create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Bangkok',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('wechat', 'x', 'substack', 'manual', 'recommendation', 'entertainment')),
  name text not null,
  external_id text not null default '',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_type, external_id)
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references public.content_sources(id) on delete set null,
  source_type text not null check (source_type in ('wechat', 'x', 'substack', 'manual', 'recommendation', 'entertainment')),
  source_subtype text,
  external_id text not null,
  content_kind text not null default 'article' check (content_kind in ('article', 'video', 'thread', 'audio', 'bookmark', 'note')),
  title text not null,
  source_name text,
  author text,
  original_url text,
  canonical_url text,
  saved_at timestamptz,
  published_at timestamptz,
  markdown text,
  plain_text text,
  excerpt text,
  cover_image_url text,
  estimated_minutes integer not null default 1 check (estimated_minutes >= 0),
  word_count integer not null default 0 check (word_count >= 0),
  status text not null default 'unread' check (status in ('unread', 'reading', 'read', 'archived', 'deleted')),
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_type, external_id)
);

create table public.content_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.content_items(id) on delete cascade,
  rating smallint not null check (rating between -2 and 2),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create table public.reading_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references public.content_items(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'opened',
      'started',
      'progressed',
      'completed',
      'marked_read',
      'archived',
      'liked',
      'disliked',
      'dismissed',
      'pushed'
    )
  ),
  progress_ratio numeric(5, 4) check (progress_ratio is null or (progress_ratio >= 0 and progress_ratio <= 1)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.device_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'web', 'macos')),
  device_name text,
  app_version text,
  push_token text,
  notifications_enabled boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, push_token)
);

create table public.push_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references public.content_items(id) on delete cascade,
  device_id uuid references public.device_installations(id) on delete set null,
  kind text not null check (kind in ('new_item', 'unread_digest', 'resume_reading', 'replacement_prompt')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped', 'cancelled')),
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.block_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('manual', 'focus', 'sleep', 'scheduled', 'strict')),
  is_active boolean not null default true,
  selected_target_count integer not null default 0 check (selected_target_count >= 0),
  allow_temporary_unlock boolean not null default true,
  default_unlock_minutes integer not null default 10 check (default_unlock_minutes >= 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.block_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.block_profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'expired')),
  reason text,
  strict_mode boolean not null default false,
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  completed_at timestamptz,
  selected_target_count integer not null default 0 check (selected_target_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.intervention_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  block_session_id uuid references public.block_sessions(id) on delete set null,
  event_type text not null check (
    event_type in (
      'shield_seen',
      'friction_started',
      'friction_completed',
      'intent_prompted',
      'temporary_unlock_requested',
      'temporary_unlock_granted',
      'blocked_again',
      'hard_blocked',
      'opened_replacement_content'
    )
  ),
  target_token_hash text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index content_items_user_status_saved_idx
  on public.content_items (user_id, status, saved_at desc);

create index content_items_user_source_idx
  on public.content_items (user_id, source_type, source_subtype);

create index reading_events_user_item_idx
  on public.reading_events (user_id, item_id, created_at desc);

create index push_jobs_pending_idx
  on public.push_jobs (scheduled_at)
  where status = 'pending';

create index block_sessions_user_status_idx
  on public.block_sessions (user_id, status, started_at desc);

create index intervention_events_session_idx
  on public.intervention_events (block_session_id, created_at desc);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger content_sources_set_updated_at
  before update on public.content_sources
  for each row execute function public.set_updated_at();

create trigger content_items_set_updated_at
  before update on public.content_items
  for each row execute function public.set_updated_at();

create trigger content_feedback_set_updated_at
  before update on public.content_feedback
  for each row execute function public.set_updated_at();

create trigger device_installations_set_updated_at
  before update on public.device_installations
  for each row execute function public.set_updated_at();

create trigger push_jobs_set_updated_at
  before update on public.push_jobs
  for each row execute function public.set_updated_at();

create trigger block_profiles_set_updated_at
  before update on public.block_profiles
  for each row execute function public.set_updated_at();

create trigger block_sessions_set_updated_at
  before update on public.block_sessions
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.content_sources enable row level security;
alter table public.content_items enable row level security;
alter table public.content_feedback enable row level security;
alter table public.reading_events enable row level security;
alter table public.device_installations enable row level security;
alter table public.push_jobs enable row level security;
alter table public.block_profiles enable row level security;
alter table public.block_sessions enable row level security;
alter table public.intervention_events enable row level security;

create policy "profiles are owned by the signed in user"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "content sources are owned by the signed in user"
  on public.content_sources for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "content items are owned by the signed in user"
  on public.content_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "content feedback is owned by the signed in user"
  on public.content_feedback for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reading events are owned by the signed in user"
  on public.reading_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "device installations are owned by the signed in user"
  on public.device_installations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "push jobs are owned by the signed in user"
  on public.push_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "block profiles are owned by the signed in user"
  on public.block_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "block sessions are owned by the signed in user"
  on public.block_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "intervention events are owned by the signed in user"
  on public.intervention_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
