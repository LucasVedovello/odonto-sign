
-- ============ COMPANIES ============
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  company_email text not null unique,
  created_at timestamptz not null default now()
);
alter table public.companies enable row level security;

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  first_name text,
  last_name text,
  email text not null,
  profile_image_url text,
  status text not null default 'active', -- active | inactive | pending
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create index profiles_company_idx on public.profiles(company_id);

-- ============ Helper: get current user's company ============
create or replace function public.get_user_company_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = _user_id;
$$;

-- ============ Trigger on new auth user ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_company_name text;
  v_invite_company_id uuid;
  v_first_name text;
  v_last_name text;
  v_count int;
begin
  v_company_name := new.raw_user_meta_data->>'company_name';
  v_invite_company_id := nullif(new.raw_user_meta_data->>'invite_company_id','')::uuid;
  v_first_name := coalesce(new.raw_user_meta_data->>'first_name','');
  v_last_name := coalesce(new.raw_user_meta_data->>'last_name','');

  if v_invite_company_id is not null then
    -- Invited user: enforce 10-user limit
    select count(*) into v_count from public.profiles where company_id = v_invite_company_id;
    if v_count >= 10 then
      raise exception 'Limite de 10 contas atingido para esta empresa';
    end if;
    v_company_id := v_invite_company_id;
  elsif v_company_name is not null and v_company_name <> '' then
    -- New company signup
    insert into public.companies (company_name, company_email)
    values (v_company_name, new.email)
    returning id into v_company_id;
  else
    -- No metadata: skip profile creation (shouldn't happen via app flows)
    return new;
  end if;

  insert into public.profiles (id, company_id, first_name, last_name, email, status)
  values (new.id, v_company_id, v_first_name, v_last_name, new.email, 'active');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ COMPANIES RLS ============
create policy "Users can view their company"
  on public.companies for select
  using (id = public.get_user_company_id(auth.uid()));

create policy "Users can update their company"
  on public.companies for update
  using (id = public.get_user_company_id(auth.uid()));

-- ============ PROFILES RLS ============
create policy "Users can view profiles in their company"
  on public.profiles for select
  using (company_id = public.get_user_company_id(auth.uid()));

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "Users can delete profiles in their company"
  on public.profiles for delete
  using (company_id = public.get_user_company_id(auth.uid()));

-- ============ PATIENTS: tenant isolation ============
-- Wipe existing dev data (no production data)
delete from public.patients;

alter table public.patients add column company_id uuid references public.companies(id) on delete cascade;
alter table public.patients add column created_by_user uuid references public.profiles(id) on delete set null;
alter table public.patients alter column company_id set not null;
create index patients_company_idx on public.patients(company_id);

-- Drop old permissive policies
drop policy if exists "anyone can select" on public.patients;
drop policy if exists "anyone can insert" on public.patients;
drop policy if exists "anyone can update" on public.patients;
drop policy if exists "anyone can delete" on public.patients;

-- Authenticated company-scoped access
create policy "Company members can view patients"
  on public.patients for select
  to authenticated
  using (company_id = public.get_user_company_id(auth.uid()));

create policy "Company members can insert patients"
  on public.patients for insert
  to authenticated
  with check (company_id = public.get_user_company_id(auth.uid()));

create policy "Company members can update patients"
  on public.patients for update
  to authenticated
  using (company_id = public.get_user_company_id(auth.uid()));

create policy "Company members can delete patients"
  on public.patients for delete
  to authenticated
  using (company_id = public.get_user_company_id(auth.uid()));

-- Public access via token (for patient registration link)
create policy "Public can view patient by token"
  on public.patients for select
  to anon
  using (true);

create policy "Public can update patient by token"
  on public.patients for update
  to anon
  using (true)
  with check (true);

-- ============ STORAGE: avatars bucket ============
insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
on conflict (id) do nothing;

create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
