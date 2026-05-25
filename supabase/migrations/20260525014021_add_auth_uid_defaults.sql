alter table public.content_sources
  alter column user_id set default auth.uid();

alter table public.content_items
  alter column user_id set default auth.uid();

alter table public.content_feedback
  alter column user_id set default auth.uid();

alter table public.reading_events
  alter column user_id set default auth.uid();

alter table public.device_installations
  alter column user_id set default auth.uid();

alter table public.push_jobs
  alter column user_id set default auth.uid();

alter table public.block_profiles
  alter column user_id set default auth.uid();

alter table public.block_sessions
  alter column user_id set default auth.uid();

alter table public.intervention_events
  alter column user_id set default auth.uid();

grant usage on schema public to authenticated;

grant select, insert, update, delete
  on public.profiles,
     public.content_sources,
     public.content_items,
     public.content_feedback,
     public.reading_events,
     public.device_installations,
     public.push_jobs,
     public.block_profiles,
     public.block_sessions,
     public.intervention_events
  to authenticated;
