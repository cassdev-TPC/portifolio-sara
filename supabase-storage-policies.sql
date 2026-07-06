-- Execute este SQL no Supabase SQL Editor depois de criar o projeto.
-- Troque o e-mail/UUID na seção "administradora" pelos dados reais da conta da Sara.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Admin users can read own admin row" on public.admin_users;
create policy "Admin users can read own admin row"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'galeria',
  'galeria',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view gallery files" on storage.objects;
create policy "Public can view gallery files"
on storage.objects
for select
to public
using (bucket_id = 'galeria');

drop policy if exists "Only admin can upload gallery files" on storage.objects;
create policy "Only admin can upload gallery files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'galeria'
  and (name like 'photos/%' or name like 'videos/%')
  and exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Only admin can delete gallery files" on storage.objects;
create policy "Only admin can delete gallery files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'galeria'
  and exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

-- Depois de cadastrar a Sara em Authentication > Users, copie o UUID dela e execute:
-- insert into public.admin_users (user_id, email)
-- values ('UUID_DA_SARA_AQUI', 'smarquesmedia@gmail.com')
-- on conflict (user_id) do update set email = excluded.email;
