-- Catalogo dos objetos ja existentes no R2. Aplicado no projeto Supabase portifolio.
create table public.gallery_media (
  id text primary key,
  kind text not null check (kind in ('photos', 'videos')),
  name text not null,
  original_path text not null,
  optimized_path text,
  thumbnail_path text,
  poster_path text,
  category text not null,
  description text not null default '',
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration numeric check (duration is null or duration >= 0),
  status text not null default 'legacy',
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint gallery_media_id_is_original check (id = original_path)
);

create index gallery_media_kind_created_at_idx on public.gallery_media (kind, created_at desc, id);
create index gallery_media_kind_category_created_at_idx on public.gallery_media (kind, category, created_at desc, id);

alter table public.gallery_media enable row level security;
revoke all on public.gallery_media from anon, authenticated;
grant select on public.gallery_media to anon, authenticated;
grant insert, update, delete on public.gallery_media to authenticated;

create policy "Publico pode ler a galeria" on public.gallery_media
  for select to anon, authenticated using (true);

create policy "Admin pode incluir midia" on public.gallery_media
  for insert to authenticated
  with check ((select auth.jwt() ->> 'email') = 'smarquesmedia@gmail.com');

create policy "Admin pode atualizar midia" on public.gallery_media
  for update to authenticated
  using ((select auth.jwt() ->> 'email') = 'smarquesmedia@gmail.com')
  with check ((select auth.jwt() ->> 'email') = 'smarquesmedia@gmail.com');

create policy "Admin pode excluir midia" on public.gallery_media
  for delete to authenticated
  using ((select auth.jwt() ->> 'email') = 'smarquesmedia@gmail.com');
