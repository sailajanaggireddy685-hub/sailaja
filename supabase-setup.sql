-- NoteNest shared file library setup.
-- IMPORTANT: These policies allow anonymous visitors to read, upload, edit and delete files.
-- Use only for a public demo. For a private college library, add Supabase Auth and restrict policies.

create table if not exists public.files (
  id text primary key,
  metadata jsonb not null,
  storage_path text,
  created_at timestamptz not null default now()
);

alter table public.files enable row level security;
grant select, insert, update, delete on public.files to anon, authenticated;

drop policy if exists "Public can read NoteNest files" on public.files;
create policy "Public can read NoteNest files" on public.files for select to anon, authenticated using (true);
drop policy if exists "Public can add NoteNest files" on public.files;
create policy "Public can add NoteNest files" on public.files for insert to anon, authenticated with check (true);
drop policy if exists "Public can update NoteNest files" on public.files;
create policy "Public can update NoteNest files" on public.files for update to anon, authenticated using (true) with check (true);
drop policy if exists "Public can delete NoteNest files" on public.files;
create policy "Public can delete NoteNest files" on public.files for delete to anon, authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('study-files', 'study-files', true, 26214400)
on conflict (id) do update set public = true, file_size_limit = 26214400;

drop policy if exists "Public can read NoteNest storage" on storage.objects;
create policy "Public can read NoteNest storage" on storage.objects for select to anon, authenticated using (bucket_id = 'study-files');
drop policy if exists "Public can upload NoteNest storage" on storage.objects;
create policy "Public can upload NoteNest storage" on storage.objects for insert to anon, authenticated with check (bucket_id = 'study-files');
drop policy if exists "Public can update NoteNest storage" on storage.objects;
create policy "Public can update NoteNest storage" on storage.objects for update to anon, authenticated using (bucket_id = 'study-files') with check (bucket_id = 'study-files');
drop policy if exists "Public can delete NoteNest storage" on storage.objects;
create policy "Public can delete NoteNest storage" on storage.objects for delete to anon, authenticated using (bucket_id = 'study-files');
