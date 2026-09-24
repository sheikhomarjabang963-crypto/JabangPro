-- =====================================================================
-- JabangPro — Production Schema
-- Multi-tenant POS/Inventory SaaS. No suppliers, no tax, optional branches.
-- Roles: super_admin (platform), owner / manager / cashier (per business).
-- Manager permissions are per-module and owner-configurable (not owner-equal).
-- Cashier never receives cost/profit/expense data at any layer.
-- NOT applied to a live project yet — review before running.
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
-- 1. TABLES
-- =====================================================================

-- Mirrors auth.users with app-level profile data.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- Platform-level admins. Deliberately a separate table, not a column on
-- profiles, so no business-scoped RPC can ever touch it.
create table if not exists public.super_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'trial'
    check (status in ('trial','active','overdue','suspended','expired','rejected')),
  trial_start timestamptz,
  trial_end timestamptz,
  subscription_period_start date,
  subscription_period_end date,
  payment_status text not null default 'trial',
  created_at timestamptz not null default now()
);

create table if not exists public.business_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  business_name text not null,
  contact_name text not null,
  phone text,
  email text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  resulting_business_id uuid references public.businesses(id),
  created_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- permissions jsonb is only meaningful for role='manager'. Example:
-- {"products":true,"inventory":true,"customers":true,"sales":true,
--  "purchases":false,"expenses":false,"reports":false,"settings":false}
create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','manager','cashier')),
  branch_id uuid references public.branches(id), -- null = all branches
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  receipt_header text,
  receipt_footer text,
  enabled_payment_methods jsonb not null default '["cash"]'::jsonb,
  currency text not null default 'GMD'
);

-- Super Admin's record of subscription payments (distinct from POS `payments`).
create table if not exists public.business_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  period_start date,
  period_end date,
  recorded_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id),
  name text not null,
  sku text,
  barcode text,
  image_url text,
  cost_price numeric not null default 0 check (cost_price >= 0),
  selling_price numeric not null default 0 check (selling_price >= 0),
  low_stock_threshold numeric not null default 0,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);

-- Stock lives here, per branch, never on products directly.
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric not null default 0,
  unique (branch_id, product_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text,
  credit_balance numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  created_by uuid not null references public.profiles(id),
  total numeric not null default 0,
  purchase_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric not null check (quantity > 0),
  cost_price numeric not null check (cost_price >= 0),
  subtotal numeric not null
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  customer_id uuid references public.customers(id),
  cashier_id uuid not null references public.profiles(id),
  subtotal numeric not null default 0,
  discount_type text not null default 'none' check (discount_type in ('none','fixed','percent')),
  discount_value numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'completed' check (status in ('completed','void')),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  subtotal numeric not null
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  method text not null check (method in ('cash','card','qcell','africell_money','wave','credit')),
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  business_id uuid not null references public.businesses(id) on delete cascade,
  processed_by uuid not null references public.profiles(id),
  reason text,
  total_refund numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.returns(id) on delete cascade,
  sale_item_id uuid not null references public.sale_items(id),
  quantity numeric not null check (quantity > 0),
  refund_amount numeric not null
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id),
  category text not null,
  amount numeric not null check (amount >= 0),
  description text,
  expense_date date not null default current_date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  product_id uuid not null references public.products(id),
  change_qty numeric not null,
  reason text not null check (reason in ('purchase','sale','return','void','adjustment')),
  reference_type text,
  reference_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 2. HELPER FUNCTIONS
-- =====================================================================

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid());
$$;

create or replace function public.get_business_role(p_business_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.business_members
  where business_id = p_business_id and user_id = auth.uid();
$$;

create or replace function public.is_business_member(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid()
  );
$$;

-- True if the caller may fully use a module: owner always, manager only if
-- explicitly granted, cashier never (cashier uses its own narrow RPCs).
create or replace function public.has_module_access(p_business_id uuid, p_module text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_perms jsonb;
begin
  select role, permissions into v_role, v_perms
  from public.business_members
  where business_id = p_business_id and user_id = auth.uid();

  if v_role is null then
    return false;
  elsif v_role = 'owner' then
    return true;
  elsif v_role = 'manager' then
    return coalesce((v_perms ->> p_module)::boolean, false);
  else
    return false; -- cashier
  end if;
end;
$$;

create or replace function public.log_audit(
  p_business_id uuid, p_action text, p_entity_type text,
  p_entity_id uuid, p_details jsonb
) returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (business_id, actor_id, action, entity_type, entity_id, details)
  values (p_business_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_details);
$$;

-- =====================================================================
-- 3. TRIGGERS
-- =====================================================================

-- Creates a profile row automatically when someone signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.super_admins enable row level security;
alter table public.businesses enable row level security;
alter table public.business_applications enable row level security;
alter table public.branches enable row level security;
alter table public.business_members enable row level security;
alter table public.business_settings enable row level security;
alter table public.business_payments enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.customers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.returns enable row level security;
alter table public.return_items enable row level security;
alter table public.expenses enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs enable row level security;

-- profiles
create policy "profiles_self_select" on public.profiles for select
  using (id = auth.uid() or public.is_super_admin());
create policy "profiles_self_update" on public.profiles for update
  using (id = auth.uid());

-- super_admins: no client-facing policy needed; managed via SQL console only.

-- businesses
create policy "businesses_select" on public.businesses for select
  using (public.is_business_member(id) or public.is_super_admin());
-- No insert/update/delete policy: only SECURITY DEFINER RPCs touch this table.

-- business_applications
create policy "applications_select" on public.business_applications for select
  using (applicant_id = auth.uid() or public.is_super_admin());
create policy "applications_insert" on public.business_applications for insert
  with check (applicant_id = auth.uid());
-- updates only via approve/reject RPCs.

-- branches
create policy "branches_select" on public.branches for select
  using (public.is_business_member(business_id) or public.is_super_admin());
create policy "branches_write" on public.branches for all
  using (public.has_module_access(business_id, 'settings'))
  with check (public.has_module_access(business_id, 'settings'));

-- business_members
create policy "members_select" on public.business_members for select
  using (public.is_business_member(business_id) or public.is_super_admin());
-- insert/update/delete only via owner-only RPCs below.

-- business_settings
create policy "settings_select" on public.business_settings for select
  using (public.is_business_member(business_id) or public.is_super_admin());
create policy "settings_write" on public.business_settings for all
  using (public.get_business_role(business_id) = 'owner')
  with check (public.get_business_role(business_id) = 'owner');

-- business_payments: Super Admin only.
create policy "business_payments_select" on public.business_payments for select
  using (public.is_super_admin());

-- categories
create policy "categories_select" on public.categories for select
  using (public.is_business_member(business_id) or public.is_super_admin());
create policy "categories_write" on public.categories for all
  using (public.has_module_access(business_id, 'products'))
  with check (public.has_module_access(business_id, 'products'));

-- products: owner/manager(with products permission) get full rows including
-- cost_price. Cashiers do NOT get a select policy here at all — they read
-- catalog data exclusively through get_pos_catalog(), which omits cost.
create policy "products_select" on public.products for select
  using (public.has_module_access(business_id, 'products') or public.is_super_admin());
create policy "products_write" on public.products for all
  using (public.has_module_access(business_id, 'products'))
  with check (public.has_module_access(business_id, 'products'));

-- inventory: same pattern as products — direct table access is owner/manager
-- only; cashiers get quantities via get_pos_catalog().
create policy "inventory_select" on public.inventory for select
  using (public.has_module_access(business_id, 'inventory') or public.is_super_admin());
-- writes happen only inside RPCs (create_sale/create_purchase/create_return/
-- void_sale/adjust_inventory), never directly.

-- customers: any business member can view/manage contacts (no financial risk).
create policy "customers_select" on public.customers for select
  using (public.is_business_member(business_id) or public.is_super_admin());
create policy "customers_write" on public.customers for all
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

-- purchases / purchase_items: owner/manager(with purchases permission) only.
-- Cashiers never see cost data, so no cashier access at all.
create policy "purchases_select" on public.purchases for select
  using (public.has_module_access(business_id, 'purchases') or public.is_super_admin());
create policy "purchase_items_select" on public.purchase_items for select
  using (exists (
    select 1 from public.purchases p
    where p.id = purchase_id and public.has_module_access(p.business_id, 'purchases')
  ));
-- writes only via create_purchase RPC.

-- sales: owner/manager(with sales permission) see all; cashier sees only
-- sales they personally rang up.
create policy "sales_select" on public.sales for select
  using (
    public.has_module_access(business_id, 'sales')
    or (public.get_business_role(business_id) = 'cashier' and cashier_id = auth.uid())
    or public.is_super_admin()
  );
create policy "sale_items_select" on public.sale_items for select
  using (exists (
    select 1 from public.sales s where s.id = sale_id and (
      public.has_module_access(s.business_id, 'sales')
      or (public.get_business_role(s.business_id) = 'cashier' and s.cashier_id = auth.uid())
    )
  ));
-- writes only via create_sale / void_sale RPCs.

-- payments: mirrors sales visibility.
create policy "payments_select" on public.payments for select
  using (exists (
    select 1 from public.sales s where s.id = sale_id and (
      public.has_module_access(s.business_id, 'sales')
      or (public.get_business_role(s.business_id) = 'cashier' and s.cashier_id = auth.uid())
    )
  ));

-- returns / return_items: owner/manager(with sales permission) only.
create policy "returns_select" on public.returns for select
  using (public.has_module_access(business_id, 'sales') or public.is_super_admin());
create policy "return_items_select" on public.return_items for select
  using (exists (
    select 1 from public.returns r where r.id = return_id
    and public.has_module_access(r.business_id, 'sales')
  ));
-- writes only via create_return RPC.

-- expenses: owner/manager(with expenses permission) only. No cashier access.
create policy "expenses_select" on public.expenses for select
  using (public.has_module_access(business_id, 'expenses') or public.is_super_admin());
-- writes only via create_expense RPC.

-- inventory_movements: audit trail, owner/manager(inventory permission) only.
create policy "movements_select" on public.inventory_movements for select
  using (public.has_module_access(business_id, 'inventory') or public.is_super_admin());
-- system-written only, via RPCs.

-- audit_logs
create policy "audit_select" on public.audit_logs for select
  using (public.has_module_access(business_id, 'reports') or public.is_super_admin());
-- system-written only, via log_audit().

-- =====================================================================
-- 5. RPCs
-- =====================================================================

-- ---------- Super Admin: onboarding ----------

create or replace function public.approve_business_application(p_application_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_app record;
  v_business_id uuid;
  v_branch_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_app from public.business_applications where id = p_application_id;
  if v_app is null or v_app.status <> 'pending' then
    raise exception 'application not found or already processed';
  end if;

  insert into public.businesses (name, status, trial_start, trial_end, payment_status)
  values (v_app.business_name, 'trial', now(), now() + interval '7 days', 'trial')
  returning id into v_business_id;

  insert into public.branches (business_id, name, is_default)
  values (v_business_id, 'Main', true)
  returning id into v_branch_id;

  insert into public.business_settings (business_id) values (v_business_id);

  insert into public.business_members (business_id, user_id, role, branch_id)
  values (v_business_id, v_app.applicant_id, 'owner', null);

  update public.business_applications
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      resulting_business_id = v_business_id
  where id = p_application_id;

  perform public.log_audit(v_business_id, 'approve_business', 'business', v_business_id, null);
  return v_business_id;
end;
$$;

create or replace function public.reject_business_application(p_application_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;

  update public.business_applications
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_application_id and status = 'pending';

  perform public.log_audit(null, 'reject_business', 'business_application', p_application_id,
    jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.suspend_business(p_business_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;
  update public.businesses set status = 'suspended' where id = p_business_id;
  perform public.log_audit(p_business_id, 'suspend_business', 'business', p_business_id, null);
end;
$$;

create or replace function public.reactivate_business(p_business_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;
  update public.businesses set status = 'active' where id = p_business_id;
  perform public.log_audit(p_business_id, 'reactivate_business', 'business', p_business_id, null);
end;
$$;

create or replace function public.record_business_payment(
  p_business_id uuid, p_amount numeric, p_period_start date, p_period_end date, p_note text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;

  insert into public.business_payments (business_id, amount, period_start, period_end, recorded_by, note)
  values (p_business_id, p_amount, p_period_start, p_period_end, auth.uid(), p_note)
  returning id into v_id;

  update public.businesses
  set status = 'active', payment_status = 'paid',
      subscription_period_start = p_period_start, subscription_period_end = p_period_end
  where id = p_business_id;

  perform public.log_audit(p_business_id, 'record_payment', 'business_payment', v_id,
    jsonb_build_object('amount', p_amount));
  return v_id;
end;
$$;

-- ---------- Owner: staff management ----------

create or replace function public.add_business_member(
  p_business_id uuid, p_email text, p_role text, p_branch_id uuid, p_permissions jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_member_id uuid;
begin
  if public.get_business_role(p_business_id) <> 'owner' then
    raise exception 'not authorized';
  end if;
  if p_role not in ('manager','cashier') then
    raise exception 'owner cannot create additional owners here';
  end if;

  select id into v_user_id from public.profiles where email = p_email;
  if v_user_id is null then
    raise exception 'no user found with that email — they must sign up first';
  end if;

  insert into public.business_members (business_id, user_id, role, branch_id, permissions)
  values (p_business_id, v_user_id, p_role, p_branch_id,
          case when p_role = 'manager' then coalesce(p_permissions, '{}'::jsonb) else '{}'::jsonb end)
  returning id into v_member_id;

  perform public.log_audit(p_business_id, 'add_member', 'business_member', v_member_id,
    jsonb_build_object('role', p_role));
  return v_member_id;
end;
$$;

create or replace function public.update_manager_permissions(p_member_id uuid, p_permissions jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_role text;
begin
  select business_id, role into v_business_id, v_role
  from public.business_members where id = p_member_id;

  if v_role <> 'manager' then
    raise exception 'permissions only apply to managers';
  end if;
  if public.get_business_role(v_business_id) <> 'owner' then
    raise exception 'not authorized';
  end if;

  update public.business_members set permissions = p_permissions where id = p_member_id;
  perform public.log_audit(v_business_id, 'update_permissions', 'business_member', p_member_id, p_permissions);
end;
$$;

create or replace function public.update_business_member_role(p_member_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
begin
  select business_id into v_business_id from public.business_members where id = p_member_id;
  if public.get_business_role(v_business_id) <> 'owner' then
    raise exception 'not authorized';
  end if;
  if p_role not in ('manager','cashier') then
    raise exception 'invalid role';
  end if;

  update public.business_members
  set role = p_role, permissions = case when p_role = 'manager' then permissions else '{}'::jsonb end
  where id = p_member_id;
end;
$$;

create or replace function public.remove_business_member(p_member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_role text;
begin
  select business_id, role into v_business_id, v_role from public.business_members where id = p_member_id;
  if public.get_business_role(v_business_id) <> 'owner' then
    raise exception 'not authorized';
  end if;
  if v_role = 'owner' then
    raise exception 'cannot remove the owner';
  end if;

  delete from public.business_members where id = p_member_id;
end;
$$;

-- ---------- POS / catalog ----------

-- Cost-free catalog for POS screens. Any business member may call this.
create or replace function public.get_pos_catalog(p_business_id uuid, p_branch_id uuid)
returns table (
  product_id uuid, name text, sku text, barcode text, image_url text,
  selling_price numeric, category_id uuid, quantity numeric
) language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.sku, p.barcode, p.image_url, p.selling_price, p.category_id,
         coalesce(i.quantity, 0)
  from public.products p
  left join public.inventory i on i.product_id = p.id and i.branch_id = p_branch_id
  where p.business_id = p_business_id
    and p.status = 'active'
    and public.is_business_member(p_business_id);
$$;

-- ---------- Sales (atomic) ----------

-- p_items: [{"product_id": "...", "quantity": 2, "unit_price": 15}]
-- p_payments: [{"method": "cash", "amount": 30}]
create or replace function public.create_sale(
  p_business_id uuid, p_branch_id uuid, p_customer_id uuid,
  p_items jsonb, p_payments jsonb, p_discount_type text, p_discount_value numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_payment jsonb;
  v_subtotal numeric := 0;
  v_total numeric;
  v_paid numeric := 0;
  v_qty numeric;
  v_stock numeric;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'not authorized';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric;
  end loop;

  v_total := case p_discount_type
    when 'fixed' then greatest(v_subtotal - p_discount_value, 0)
    when 'percent' then v_subtotal - (v_subtotal * p_discount_value / 100)
    else v_subtotal
  end;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    v_paid := v_paid + (v_payment->>'amount')::numeric;
  end loop;
  if v_paid <> v_total and not exists (
    select 1 from jsonb_array_elements(p_payments) pay where pay->>'method' = 'credit'
  ) then
    raise exception 'payments (%) do not match total (%)', v_paid, v_total;
  end if;

  insert into public.sales (business_id, branch_id, customer_id, cashier_id, subtotal,
    discount_type, discount_value, total, status)
  values (p_business_id, p_branch_id, p_customer_id, auth.uid(), v_subtotal,
    coalesce(p_discount_type,'none'), coalesce(p_discount_value,0), v_total, 'completed')
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;

    select quantity into v_stock from public.inventory
    where branch_id = p_branch_id and product_id = (v_item->>'product_id')::uuid
    for update;

    if v_stock is null or v_stock < v_qty then
      raise exception 'insufficient stock for product %', v_item->>'product_id';
    end if;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    values (v_sale_id, (v_item->>'product_id')::uuid, v_qty, (v_item->>'unit_price')::numeric,
      v_qty * (v_item->>'unit_price')::numeric);

    update public.inventory set quantity = quantity - v_qty
    where branch_id = p_branch_id and product_id = (v_item->>'product_id')::uuid;

    insert into public.inventory_movements (business_id, branch_id, product_id, change_qty,
      reason, reference_type, reference_id, created_by)
    values (p_business_id, p_branch_id, (v_item->>'product_id')::uuid, -v_qty,
      'sale', 'sale', v_sale_id, auth.uid());
  end loop;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    insert into public.payments (sale_id, method, amount)
    values (v_sale_id, v_payment->>'method', (v_payment->>'amount')::numeric);
  end loop;

  if p_customer_id is not null and exists (
    select 1 from jsonb_array_elements(p_payments) pay where pay->>'method' = 'credit'
  ) then
    update public.customers set credit_balance = credit_balance + v_total where id = p_customer_id;
  end if;

  perform public.log_audit(p_business_id, 'create_sale', 'sale', v_sale_id,
    jsonb_build_object('total', v_total));
  return v_sale_id;
end;
$$;

create or replace function public.void_sale(p_sale_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_sale record;
  v_item record;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  if v_sale is null then
    raise exception 'sale not found';
  end if;
  if not public.has_module_access(v_sale.business_id, 'sales') then
    raise exception 'not authorized';
  end if;
  if v_sale.status = 'void' then
    raise exception 'sale already voided';
  end if;

  for v_item in select * from public.sale_items where sale_id = p_sale_id loop
    update public.inventory set quantity = quantity + v_item.quantity
    where branch_id = v_sale.branch_id and product_id = v_item.product_id;

    insert into public.inventory_movements (business_id, branch_id, product_id, change_qty,
      reason, reference_type, reference_id, created_by)
    values (v_sale.business_id, v_sale.branch_id, v_item.product_id, v_item.quantity,
      'void', 'sale', p_sale_id, auth.uid());
  end loop;

  update public.sales set status = 'void' where id = p_sale_id;

  perform public.log_audit(v_sale.business_id, 'void_sale', 'sale', p_sale_id,
    jsonb_build_object('reason', p_reason));
end;
$$;

-- p_items: [{"sale_item_id": "...", "quantity": 1, "refund_amount": 15}]
create or replace function public.create_return(p_sale_id uuid, p_items jsonb, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sale record;
  v_return_id uuid;
  v_item jsonb;
  v_sale_item record;
  v_total_refund numeric := 0;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  if v_sale is null then
    raise exception 'sale not found';
  end if;
  if not public.has_module_access(v_sale.business_id, 'sales') then
    raise exception 'not authorized';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total_refund := v_total_refund + (v_item->>'refund_amount')::numeric;
  end loop;

  insert into public.returns (sale_id, business_id, processed_by, reason, total_refund)
  values (p_sale_id, v_sale.business_id, auth.uid(), p_reason, v_total_refund)
  returning id into v_return_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_sale_item from public.sale_items where id = (v_item->>'sale_item_id')::uuid;

    insert into public.return_items (return_id, sale_item_id, quantity, refund_amount)
    values (v_return_id, v_sale_item.id, (v_item->>'quantity')::numeric,
      (v_item->>'refund_amount')::numeric);

    update public.inventory set quantity = quantity + (v_item->>'quantity')::numeric
    where branch_id = v_sale.branch_id and product_id = v_sale_item.product_id;

    insert into public.inventory_movements (business_id, branch_id, product_id, change_qty,
      reason, reference_type, reference_id, created_by)
    values (v_sale.business_id, v_sale.branch_id, v_sale_item.product_id,
      (v_item->>'quantity')::numeric, 'return', 'return', v_return_id, auth.uid());
  end loop;

  if v_sale.customer_id is not null then
    update public.customers set credit_balance = greatest(credit_balance - v_total_refund, 0)
    where id = v_sale.customer_id;
  end if;

  perform public.log_audit(v_sale.business_id, 'create_return', 'return', v_return_id,
    jsonb_build_object('total_refund', v_total_refund));
  return v_return_id;
end;
$$;

-- ---------- Purchases (atomic) ----------

-- p_items: [{"product_id": "...", "quantity": 10, "cost_price": 8}]
create or replace function public.create_purchase(
  p_business_id uuid, p_branch_id uuid, p_items jsonb, p_purchase_date date
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_purchase_id uuid;
  v_item jsonb;
  v_total numeric := 0;
  v_qty numeric;
  v_cost numeric;
begin
  if not public.has_module_access(p_business_id, 'purchases') then
    raise exception 'not authorized';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + (v_item->>'quantity')::numeric * (v_item->>'cost_price')::numeric;
  end loop;

  insert into public.purchases (business_id, branch_id, created_by, total, purchase_date)
  values (p_business_id, p_branch_id, auth.uid(), v_total, coalesce(p_purchase_date, current_date))
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_cost := (v_item->>'cost_price')::numeric;

    insert into public.purchase_items (purchase_id, product_id, quantity, cost_price, subtotal)
    values (v_purchase_id, (v_item->>'product_id')::uuid, v_qty, v_cost, v_qty * v_cost);

    insert into public.inventory (business_id, branch_id, product_id, quantity)
    values (p_business_id, p_branch_id, (v_item->>'product_id')::uuid, v_qty)
    on conflict (branch_id, product_id) do update set quantity = public.inventory.quantity + v_qty;

    insert into public.inventory_movements (business_id, branch_id, product_id, change_qty,
      reason, reference_type, reference_id, created_by)
    values (p_business_id, p_branch_id, (v_item->>'product_id')::uuid, v_qty,
      'purchase', 'purchase', v_purchase_id, auth.uid());
  end loop;

  perform public.log_audit(p_business_id, 'create_purchase', 'purchase', v_purchase_id,
    jsonb_build_object('total', v_total));
  return v_purchase_id;
end;
$$;

create or replace function public.adjust_inventory(
  p_business_id uuid, p_branch_id uuid, p_product_id uuid, p_change_qty numeric, p_reason text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_module_access(p_business_id, 'inventory') then
    raise exception 'not authorized';
  end if;

  insert into public.inventory (business_id, branch_id, product_id, quantity)
  values (p_business_id, p_branch_id, p_product_id, greatest(p_change_qty, 0))
  on conflict (branch_id, product_id) do update
    set quantity = greatest(public.inventory.quantity + p_change_qty, 0);

  insert into public.inventory_movements (business_id, branch_id, product_id, change_qty,
    reason, reference_type, created_by)
  values (p_business_id, p_branch_id, p_product_id, p_change_qty, 'adjustment', 'manual', auth.uid());

  perform public.log_audit(p_business_id, 'adjust_inventory', 'product', p_product_id,
    jsonb_build_object('change_qty', p_change_qty, 'reason', p_reason));
end;
$$;

-- ---------- Expenses ----------

create or replace function public.create_expense(
  p_business_id uuid, p_branch_id uuid, p_category text, p_amount numeric,
  p_description text, p_expense_date date
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.has_module_access(p_business_id, 'expenses') then
    raise exception 'not authorized';
  end if;

  insert into public.expenses (business_id, branch_id, category, amount, description,
    expense_date, created_by)
  values (p_business_id, p_branch_id, p_category, p_amount, p_description,
    coalesce(p_expense_date, current_date), auth.uid())
  returning id into v_id;

  perform public.log_audit(p_business_id, 'create_expense', 'expense', v_id,
    jsonb_build_object('amount', p_amount));
  return v_id;
end;
$$;

-- ---------- Reporting ----------

-- Requires the 'reports' permission — the only place profit/margin figures
-- are computed and returned.
create or replace function public.get_dashboard_summary(p_business_id uuid, p_branch_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  if not public.has_module_access(p_business_id, 'reports') then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'sales_today', coalesce((select sum(total) from public.sales
      where business_id = p_business_id and branch_id = p_branch_id
      and status = 'completed' and created_at >= current_date), 0),
    'sales_week', coalesce((select sum(total) from public.sales
      where business_id = p_business_id and branch_id = p_branch_id
      and status = 'completed' and created_at >= date_trunc('week', now())), 0),
    'sales_month', coalesce((select sum(total) from public.sales
      where business_id = p_business_id and branch_id = p_branch_id
      and status = 'completed' and created_at >= date_trunc('month', now())), 0),
    'expenses_month', coalesce((select sum(amount) from public.expenses
      where business_id = p_business_id and branch_id = p_branch_id
      and expense_date >= date_trunc('month', now())::date), 0),
    'outstanding_credit', coalesce((select sum(credit_balance) from public.customers
      where business_id = p_business_id), 0),
    'low_stock', (select coalesce(jsonb_agg(jsonb_build_object('product_id', p.id,
        'name', p.name, 'quantity', i.quantity)), '[]'::jsonb)
      from public.inventory i join public.products p on p.id = i.product_id
      where i.branch_id = p_branch_id and i.quantity <= p.low_stock_threshold)
  ) into v_result;

  return v_result;
end;
$$;

-- Cashier-safe: own completed sales only, no cost/profit fields.
create or replace function public.get_my_sales(p_business_id uuid)
returns table (sale_id uuid, total numeric, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, total, status, created_at from public.sales
  where business_id = p_business_id and cashier_id = auth.uid()
  order by created_at desc;
$$;
