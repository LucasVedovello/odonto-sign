
-- Tighten public patient update: only allow updating unsigned records
drop policy if exists "Public can update patient by token" on public.patients;
create policy "Public can update unsigned patient"
  on public.patients for update
  to anon
  using (signed_at is null)
  with check (true);

-- Lock down SECURITY DEFINER functions
revoke execute on function public.get_user_company_id(uuid) from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- Restrict avatar listing (direct URL reads still work because bucket is public)
drop policy if exists "Avatars are publicly readable" on storage.objects;
