create extension if not exists pgcrypto;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  location text,
  description text,
  starts_at date,
  ends_at date,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  profile_note text,
  coconut_x numeric(5,2) not null default 50,
  coconut_y numeric(5,2) not null default 40,
  invited_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (trip_id, user_id)
);

create table if not exists public.coconuts (
  id uuid primary key default gen_random_uuid(),
  trip_member_id uuid not null unique references public.trip_members(id) on delete cascade,
  base_image text not null,
  accessories jsonb not null default '[]'::jsonb,
  label text,
  colors jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  uploader_member_id uuid references public.trip_members(id) on delete set null,
  caption text,
  storage_path text not null,
  taken_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.photo_targets (
  photo_id uuid not null references public.photos(id) on delete cascade,
  trip_member_id uuid not null references public.trip_members(id) on delete cascade,
  tagged_by_member_id uuid references public.trip_members(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (photo_id, trip_member_id)
);

create table if not exists public.photo_likes (
  photo_id uuid not null references public.photos(id) on delete cascade,
  trip_member_id uuid not null references public.trip_members(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (photo_id, trip_member_id)
);

create table if not exists public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  trip_member_id uuid not null references public.trip_members(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.album_chats (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  album_id text not null,
  trip_member_id uuid not null references public.trip_members(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.album_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  album_id text not null,
  uploader_member_id uuid references public.trip_members(id) on delete set null,
  caption text,
  storage_path text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.album_photo_likes (
  photo_id uuid not null references public.album_photos(id) on delete cascade,
  trip_member_id uuid not null references public.trip_members(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (photo_id, trip_member_id)
);

create table if not exists public.album_photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.album_photos(id) on delete cascade,
  trip_member_id uuid not null references public.trip_members(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists trip_members_trip_id_idx on public.trip_members (trip_id);
create index if not exists photos_trip_id_idx on public.photos (trip_id, created_at desc);
create index if not exists photo_targets_member_idx on public.photo_targets (trip_member_id);
create index if not exists photo_likes_member_idx on public.photo_likes (trip_member_id);
create index if not exists photo_comments_photo_idx on public.photo_comments (photo_id, created_at desc);
create index if not exists album_chats_album_idx on public.album_chats (trip_id, album_id, created_at desc);
create index if not exists album_photos_album_idx on public.album_photos (trip_id, album_id, created_at desc);
create index if not exists album_photo_likes_member_idx on public.album_photo_likes (trip_member_id);
create index if not exists album_photo_comments_photo_idx on public.album_photo_comments (photo_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_coconuts_updated_at on public.coconuts;
create trigger set_coconuts_updated_at
before update on public.coconuts
for each row
execute function public.set_updated_at();

create or replace function public.is_trip_member(target_trip_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = target_trip_id
      and tm.user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_member_record(target_trip_member_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.trip_members tm
    where tm.id = target_trip_member_id
      and tm.user_id = auth.uid()
  );
$$;

create or replace function public.resolve_trip_id_by_slug(target_trip_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_trip_id uuid;
begin
  select t.id
  into resolved_trip_id
  from public.trips t
  where t.slug = target_trip_slug
  limit 1;

  return resolved_trip_id;
end;
$$;

create or replace function public.join_trip_by_slug(target_trip_slug text, desired_nickname text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_trip_id uuid;
  joined_member_id uuid;
  normalized_nickname text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select t.id
  into resolved_trip_id
  from public.trips t
  where t.slug = target_trip_slug
  limit 1;

  if resolved_trip_id is null then
    raise exception 'Trip not found';
  end if;

  normalized_nickname := left(coalesce(nullif(trim(desired_nickname), ''), 'Anonymous'), 8);

  insert into public.trip_members (trip_id, user_id, nickname)
  values (resolved_trip_id, auth.uid(), normalized_nickname)
  on conflict (trip_id, user_id)
  do update set nickname = excluded.nickname
  returning id into joined_member_id;

  return joined_member_id;
end;
$$;

grant execute on function public.resolve_trip_id_by_slug(text) to authenticated;
grant execute on function public.join_trip_by_slug(text, text) to authenticated;

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.coconuts enable row level security;
alter table public.photos enable row level security;
alter table public.photo_targets enable row level security;
alter table public.photo_likes enable row level security;
alter table public.photo_comments enable row level security;
alter table public.album_chats enable row level security;
alter table public.album_photos enable row level security;
alter table public.album_photo_likes enable row level security;
alter table public.album_photo_comments enable row level security;

drop policy if exists "trip members can view trips" on public.trips;
create policy "trip members can view trips"
on public.trips
for select
using (public.is_trip_member(id));

drop policy if exists "authenticated users can create trips" on public.trips;
create policy "authenticated users can create trips"
on public.trips
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "trip owners can update trips" on public.trips;
create policy "trip owners can update trips"
on public.trips
for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "trip members can view members" on public.trip_members;
create policy "trip members can view members"
on public.trip_members
for select
using (public.is_trip_member(trip_id));

drop policy if exists "trip owners can invite members" on public.trip_members;
create policy "trip owners can invite members"
on public.trip_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.trips t
    where t.id = trip_id
      and t.owner_user_id = auth.uid()
  )
);

drop policy if exists "authenticated users can join trips as themselves" on public.trip_members;
create policy "authenticated users can join trips as themselves"
on public.trip_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.trips t
    where t.id = trip_id
  )
);

drop policy if exists "members can update themselves" on public.trip_members;
create policy "members can update themselves"
on public.trip_members
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "trip members can view coconuts" on public.coconuts;
create policy "trip members can view coconuts"
on public.coconuts
for select
using (
  exists (
    select 1
    from public.trip_members tm
    where tm.id = trip_member_id
      and public.is_trip_member(tm.trip_id)
  )
);

drop policy if exists "members manage their own coconut" on public.coconuts;
create policy "members manage their own coconut"
on public.coconuts
for all
to authenticated
using (public.is_trip_member_record(trip_member_id))
with check (public.is_trip_member_record(trip_member_id));

drop policy if exists "trip members can view photos" on public.photos;
create policy "trip members can view photos"
on public.photos
for select
using (public.is_trip_member(trip_id));

drop policy if exists "trip members can upload photos" on public.photos;
create policy "trip members can upload photos"
on public.photos
for insert
to authenticated
with check (
  public.is_trip_member(trip_id)
  and (
    uploader_member_id is null
    or exists (
      select 1
      from public.trip_members tm
      where tm.id = uploader_member_id
        and tm.user_id = auth.uid()
    )
  )
);

drop policy if exists "uploader can edit their photos" on public.photos;
create policy "uploader can edit their photos"
on public.photos
for update
using (
  exists (
    select 1
    from public.trip_members tm
    where tm.id = uploader_member_id
      and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.trip_members tm
    where tm.id = uploader_member_id
      and tm.user_id = auth.uid()
  )
);

drop policy if exists "trip members can view photo targets" on public.photo_targets;
create policy "trip members can view photo targets"
on public.photo_targets
for select
using (
  exists (
    select 1
    from public.trip_members tm
    where tm.id = trip_member_id
      and public.is_trip_member(tm.trip_id)
  )
);

drop policy if exists "trip members can tag photo targets" on public.photo_targets;
create policy "trip members can tag photo targets"
on public.photo_targets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.trip_members tm
    where tm.id = trip_member_id
      and public.is_trip_member(tm.trip_id)
  )
  and (
    tagged_by_member_id is null
    or public.is_trip_member_record(tagged_by_member_id)
  )
);

drop policy if exists "trip members can view photo likes" on public.photo_likes;
create policy "trip members can view photo likes"
on public.photo_likes
for select
using (
  exists (
    select 1
    from public.photos p
    where p.id = photo_id
      and public.is_trip_member(p.trip_id)
  )
);

drop policy if exists "members can like photos in their trip" on public.photo_likes;
create policy "members can like photos in their trip"
on public.photo_likes
for insert
to authenticated
with check (
  public.is_trip_member_record(trip_member_id)
  and exists (
    select 1
    from public.photos p
    join public.trip_members tm on tm.id = trip_member_id
    where p.id = photo_id
      and p.trip_id = tm.trip_id
  )
);

drop policy if exists "members can remove their own likes" on public.photo_likes;
create policy "members can remove their own likes"
on public.photo_likes
for delete
to authenticated
using (public.is_trip_member_record(trip_member_id));

drop policy if exists "trip members can view photo comments" on public.photo_comments;
create policy "trip members can view photo comments"
on public.photo_comments
for select
using (
  exists (
    select 1
    from public.photos p
    where p.id = photo_id
      and public.is_trip_member(p.trip_id)
  )
);

drop policy if exists "members can comment on photos in their trip" on public.photo_comments;
create policy "members can comment on photos in their trip"
on public.photo_comments
for insert
to authenticated
with check (
  public.is_trip_member_record(trip_member_id)
  and exists (
    select 1
    from public.photos p
    join public.trip_members tm on tm.id = trip_member_id
    where p.id = photo_id
      and p.trip_id = tm.trip_id
  )
);

drop policy if exists "members can delete their own photo comments" on public.photo_comments;
create policy "members can delete their own photo comments"
on public.photo_comments
for delete
to authenticated
using (public.is_trip_member_record(trip_member_id));

drop policy if exists "trip members can view album chats" on public.album_chats;
create policy "trip members can view album chats"
on public.album_chats
for select
using (
  public.is_trip_member(trip_id)
);

drop policy if exists "members can chat in albums in their trip" on public.album_chats;
create policy "members can chat in albums in their trip"
on public.album_chats
for insert
to authenticated
with check (
  public.is_trip_member_record(trip_member_id)
  and exists (
    select 1
    from public.trip_members author_tm
    where author_tm.trip_id = trip_id
      and author_tm.id = trip_member_id
  )
);

drop policy if exists "members can delete their own album chats" on public.album_chats;
create policy "members can delete their own album chats"
on public.album_chats
for delete
to authenticated
using (public.is_trip_member_record(trip_member_id));

drop policy if exists "trip members can view album photos" on public.album_photos;
create policy "trip members can view album photos"
on public.album_photos
for select
using (public.is_trip_member(trip_id));

drop policy if exists "members can upload album photos in their trip" on public.album_photos;
create policy "members can upload album photos in their trip"
on public.album_photos
for insert
to authenticated
with check (
  public.is_trip_member(trip_id)
  and (
    uploader_member_id is null
    or exists (
      select 1
      from public.trip_members tm
      where tm.id = uploader_member_id
        and tm.user_id = auth.uid()
        and tm.trip_id = trip_id
    )
  )
);

drop policy if exists "uploaders can delete their own album photos" on public.album_photos;
create policy "uploaders can delete their own album photos"
on public.album_photos
for delete
to authenticated
using (
  exists (
    select 1
    from public.trip_members tm
    where tm.id = uploader_member_id
      and tm.user_id = auth.uid()
  )
);

drop policy if exists "trip members can view album photo likes" on public.album_photo_likes;
create policy "trip members can view album photo likes"
on public.album_photo_likes
for select
using (
  exists (
    select 1
    from public.album_photos ap
    where ap.id = photo_id
      and public.is_trip_member(ap.trip_id)
  )
);

drop policy if exists "members can like album photos in their trip" on public.album_photo_likes;
create policy "members can like album photos in their trip"
on public.album_photo_likes
for insert
to authenticated
with check (
  public.is_trip_member_record(trip_member_id)
  and exists (
    select 1
    from public.album_photos ap
    join public.trip_members tm on tm.id = trip_member_id
    where ap.id = photo_id
      and ap.trip_id = tm.trip_id
  )
);

drop policy if exists "members can remove their own album photo likes" on public.album_photo_likes;
create policy "members can remove their own album photo likes"
on public.album_photo_likes
for delete
to authenticated
using (public.is_trip_member_record(trip_member_id));

drop policy if exists "trip members can view album photo comments" on public.album_photo_comments;
create policy "trip members can view album photo comments"
on public.album_photo_comments
for select
using (
  exists (
    select 1
    from public.album_photos ap
    where ap.id = photo_id
      and public.is_trip_member(ap.trip_id)
  )
);

drop policy if exists "members can comment on album photos in their trip" on public.album_photo_comments;
create policy "members can comment on album photos in their trip"
on public.album_photo_comments
for insert
to authenticated
with check (
  public.is_trip_member_record(trip_member_id)
  and exists (
    select 1
    from public.album_photos ap
    join public.trip_members tm on tm.id = trip_member_id
    where ap.id = photo_id
      and ap.trip_id = tm.trip_id
  )
);

drop policy if exists "members can delete their own album photo comments" on public.album_photo_comments;
create policy "members can delete their own album photo comments"
on public.album_photo_comments
for delete
to authenticated
using (public.is_trip_member_record(trip_member_id));

drop policy if exists "trip members can view photo targets" on public.photo_targets;
create policy "trip members can view photo targets"
on public.photo_targets
for select
using (
  exists (
    select 1
    from public.photos p
    where p.id = photo_id
      and public.is_trip_member(p.trip_id)
  )
);

drop policy if exists "trip members can tag photo targets" on public.photo_targets;
create policy "trip members can tag photo targets"
on public.photo_targets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.photos p
    join public.trip_members tm on tm.id = trip_member_id
    where p.id = photo_id
      and p.trip_id = tm.trip_id
      and public.is_trip_member(p.trip_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-photos',
  'trip-photos',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "trip members can read trip photos bucket" on storage.objects;
create policy "trip members can read trip photos bucket"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'trip-photos'
  and public.is_trip_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "trip members can upload trip photos bucket" on storage.objects;
create policy "trip members can upload trip photos bucket"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trip-photos'
  and public.is_trip_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "owners can manage their uploaded photo objects" on storage.objects;
create policy "owners can manage their uploaded photo objects"
on storage.objects
for update
to authenticated
using (bucket_id = 'trip-photos' and owner = auth.uid())
with check (bucket_id = 'trip-photos' and owner = auth.uid());

drop policy if exists "owners can delete their uploaded photo objects" on storage.objects;
create policy "owners can delete their uploaded photo objects"
on storage.objects
for delete
to authenticated
using (bucket_id = 'trip-photos' and owner = auth.uid());
