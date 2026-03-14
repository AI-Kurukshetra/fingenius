-- AuthN/AuthZ layer for MVP: role assignments, session records, and audit write policies

create table if not exists user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'ops', 'compliance_officer', 'teller', 'customer_support')),
  created_at timestamptz not null default now(),
  created_by uuid references user_profiles(id),
  unique (tenant_id, user_id, role)
);

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  session_token_hash text not null,
  ip_address inet,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, session_token_hash)
);

create index if not exists idx_user_role_assignments_tenant_user
  on user_role_assignments (tenant_id, user_id);
create index if not exists idx_auth_sessions_tenant_user
  on auth_sessions (tenant_id, user_id, revoked_at);
create index if not exists idx_auth_sessions_expires_at
  on auth_sessions (expires_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_auth_sessions_updated_at on auth_sessions;
create trigger trg_auth_sessions_updated_at
before update on auth_sessions
for each row
execute function public.set_updated_at();

-- Ensure user_profiles is always present for auth users referenced by audit/session tables.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

insert into public.user_profiles (id, full_name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  u.email
from auth.users u
on conflict (id) do nothing;

alter table user_role_assignments enable row level security;
alter table auth_sessions enable row level security;

-- User profile self access (required for auth-linked inserts and user settings)
create policy "user profiles self select"
on user_profiles
for select
using (id = (select auth.uid()));

create policy "user profiles self insert"
on user_profiles
for insert
with check (id = (select auth.uid()));

create policy "user profiles self update"
on user_profiles
for update
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Role assignment visibility: self or tenant admins
create policy "role assignments self read"
on user_role_assignments
for select
using (user_id = (select auth.uid()));

create policy "role assignments tenant admin read"
on user_role_assignments
for select
using (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = user_role_assignments.tenant_id
      and tm.is_active = true
      and tm.role in ('platform_admin', 'tenant_admin')
  )
);

create policy "role assignments tenant admin write"
on user_role_assignments
for all
using (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = user_role_assignments.tenant_id
      and tm.is_active = true
      and tm.role in ('platform_admin', 'tenant_admin')
  )
)
with check (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = user_role_assignments.tenant_id
      and tm.is_active = true
      and tm.role in ('platform_admin', 'tenant_admin')
  )
);

-- Session visibility: self or tenant admins; writes by self.
create policy "auth sessions self read"
on auth_sessions
for select
using (user_id = (select auth.uid()));

create policy "auth sessions tenant admin read"
on auth_sessions
for select
using (
  exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = auth_sessions.tenant_id
      and tm.is_active = true
      and tm.role in ('platform_admin', 'tenant_admin')
  )
);

create policy "auth sessions self write"
on auth_sessions
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Audit writes for authenticated tenant members.
create policy "tenant scoped audit logs insert"
on audit_logs
for insert
with check (
  actor_id = (select auth.uid())
  and exists (
    select 1
    from tenant_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.tenant_id = audit_logs.tenant_id
      and tm.is_active = true
  )
);
