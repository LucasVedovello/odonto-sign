
-- ============ SUPER ADMIN ============
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_super_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = _user_id), false);
$$;

revoke execute on function public.is_super_admin(uuid) from anon, public;
grant execute on function public.is_super_admin(uuid) to authenticated;

-- Allow super admins to view everything globally
create policy "Super admins view all patients"
  on public.patients for select
  to authenticated
  using (public.is_super_admin(auth.uid()));

create policy "Super admins view all companies"
  on public.companies for select
  to authenticated
  using (public.is_super_admin(auth.uid()));

create policy "Super admins view all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_super_admin(auth.uid()));

create policy "Super admins delete any patient"
  on public.patients for delete
  to authenticated
  using (public.is_super_admin(auth.uid()));

-- Restore public avatar read policy (was removed in earlier migration)
drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');
