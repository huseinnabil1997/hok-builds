-- Riwayat pick hero (hok-builds Ban & Pick). Jalankan di Supabase SQL Editor.
create table if not exists public.pick_history (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hero_slug text not null check (char_length(hero_slug) between 1 and 64),
  source text not null default 'manual' check (source in ('rekomendasi', 'manual')),
  created_at timestamptz not null default now()
);

create index if not exists pick_history_user_hero_idx on public.pick_history (user_id, hero_slug);

alter table public.pick_history enable row level security;

drop policy if exists "pick_history select own" on public.pick_history;
create policy "pick_history select own" on public.pick_history
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "pick_history insert own" on public.pick_history;
create policy "pick_history insert own" on public.pick_history
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "pick_history delete own" on public.pick_history;
create policy "pick_history delete own" on public.pick_history
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.pick_history from anon;
grant select, insert, delete on public.pick_history to authenticated;

-- Data awal pemakaian hero per akun dari HoK Camp (Battle Record > Heroes, jumlah match).
-- Dijumlahkan dengan pick_history untuk tiebreak "jarang dipakai duluan". Isi lewat scripts/import-camp-baseline.mjs.
create table if not exists public.hero_usage_baseline (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hero_slug text not null check (char_length(hero_slug) between 1 and 64),
  matches integer not null default 0 check (matches >= 0),
  source text not null default 'hokcamp',
  updated_at timestamptz not null default now(),
  primary key (user_id, hero_slug)
);

alter table public.hero_usage_baseline enable row level security;

drop policy if exists "hero_usage_baseline select own" on public.hero_usage_baseline;
create policy "hero_usage_baseline select own" on public.hero_usage_baseline
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "hero_usage_baseline insert own" on public.hero_usage_baseline;
create policy "hero_usage_baseline insert own" on public.hero_usage_baseline
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "hero_usage_baseline update own" on public.hero_usage_baseline;
create policy "hero_usage_baseline update own" on public.hero_usage_baseline
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "hero_usage_baseline delete own" on public.hero_usage_baseline;
create policy "hero_usage_baseline delete own" on public.hero_usage_baseline
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.hero_usage_baseline from anon;
grant select, insert, update, delete on public.hero_usage_baseline to authenticated;
