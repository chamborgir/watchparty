-- Run this whole file once in Supabase: SQL Editor, New query, paste, Run.
-- Safe to run on a fresh project. If you already have a "videos" table from the
-- older version, drop it first:  drop table if exists videos;

create table if not exists rooms (
  code text primary key,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  name text not null,
  url text not null,
  key text,
  size bigint,
  created_at timestamptz default now()
);

alter table rooms enable row level security;
alter table videos enable row level security;

drop policy if exists "rooms read" on rooms;
drop policy if exists "rooms insert" on rooms;
drop policy if exists "videos read" on videos;
drop policy if exists "videos insert" on videos;
drop policy if exists "videos delete" on videos;

create policy "rooms read"    on rooms  for select using (true);
create policy "rooms insert"  on rooms  for insert with check (true);
create policy "videos read"   on videos for select using (true);
create policy "videos insert" on videos for insert with check (true);
create policy "videos delete" on videos for delete using (true);


ffprobe -v error -show_entries stream=codec_type,codec_name -of csv=p=0 "C:\Users\chamb\Videos\Capcut\0320.mp4"

"C:\Users\chamb\Videos\Capcut\0320.mp4"

Invoke-WebRequest -Method Head -Uri "https://pub-4b7e9c55a5bf4d8985eaa6adf55ec4d1.r2.dev/cxmyzh/11182c3e-d3ea-487f-b99a-22a4f35a595a-0320.mp4" | Select-Object StatusCode, @{n="Type";e={$_.Headers["Content-Type"]}}, @{n="Size";e={$_.Headers["Content-Length"]}}, @{n="Ranges";e={$_.Headers["Accept-Ranges"]}}