-- Optional Life360-style “always share” preference for background location updates.

alter table public.profiles
  add column if not exists share_location_always boolean not null default false;

comment on column public.profiles.share_location_always is 'When true, client may run background location task so circle sees updates when app is not open (requires OS always/background permission).';
