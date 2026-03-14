create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
  from public.users as u
  where u.id = auth.uid()
    and u.is_active = true
  limit 1
$$;

create or replace function public.current_app_role()
returns public.role_key
language sql
stable
security definer
set search_path = public, auth
as $$
  select r.key
  from public.users as u
  inner join public.roles as r on r.id = u.role_id
  where u.id = auth.uid()
    and u.is_active = true
  limit 1
$$;

create or replace function public.is_active_app_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_app_user_id() is not null
$$;

create or replace function public.has_role(allowed_roles public.role_key[])
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(public.current_app_role() = any(allowed_roles), false)
$$;

create or replace function public.can_view_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_active_app_user()
    and (
      target_user_id = public.current_app_user_id()
      or public.has_role(array['admin'::public.role_key, 'manager'::public.role_key])
    )
$$;

create or replace function public.can_access_task(task_type public.task_type, task_assignee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]) then true
    when public.has_role(array['receiver'::public.role_key]) then task_type in ('receiving', 'putaway', 'return')
    when public.has_role(array['picker'::public.role_key]) then
      task_type = 'picking' and (task_assignee_id is null or task_assignee_id = public.current_app_user_id())
    when public.has_role(array['packer'::public.role_key]) then
      task_type = 'packing' and (task_assignee_id is null or task_assignee_id = public.current_app_user_id())
    else false
  end
$$;

create or replace function public.can_write_actor_row(target_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_active_app_user()
    and (target_actor_id is null or target_actor_id = public.current_app_user_id())
$$;

alter table public.warehouses enable row level security;
alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.zones enable row level security;
alter table public.locations enable row level security;
alter table public.bins enable row level security;
alter table public.inventory enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tasks enable row level security;
alter table public.shipments enable row level security;
alter table public.returns enable row level security;
alter table public.integrations enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs enable row level security;

create policy warehouses_read_active_users
  on public.warehouses
  for select
  to authenticated
  using (public.is_active_app_user());

create policy warehouses_manage_admin_manager
  on public.warehouses
  for all
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]))
  with check (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy roles_read_active_users
  on public.roles
  for select
  to authenticated
  using (public.is_active_app_user());

create policy roles_manage_admin
  on public.roles
  for all
  to authenticated
  using (public.has_role(array['admin'::public.role_key]))
  with check (public.has_role(array['admin'::public.role_key]));

create policy users_read_self_or_leadership
  on public.users
  for select
  to authenticated
  using (public.can_view_user(id));

create policy users_manage_admin
  on public.users
  for all
  to authenticated
  using (public.has_role(array['admin'::public.role_key]))
  with check (public.has_role(array['admin'::public.role_key]));

create policy products_read_active_users
  on public.products
  for select
  to authenticated
  using (public.is_active_app_user());

create policy products_manage_admin_manager
  on public.products
  for all
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]))
  with check (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy zones_read_active_users
  on public.zones
  for select
  to authenticated
  using (public.is_active_app_user());

create policy zones_manage_admin_manager
  on public.zones
  for all
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]))
  with check (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy locations_read_active_users
  on public.locations
  for select
  to authenticated
  using (public.is_active_app_user());

create policy locations_manage_admin_manager
  on public.locations
  for all
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]))
  with check (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy bins_read_active_users
  on public.bins
  for select
  to authenticated
  using (public.is_active_app_user());

create policy bins_manage_admin_manager
  on public.bins
  for all
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]))
  with check (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy inventory_read_receiving_and_management
  on public.inventory
  for select
  to authenticated
  using (
    public.has_role(
      array['admin'::public.role_key, 'manager'::public.role_key, 'receiver'::public.role_key]
    )
  );

create policy inventory_insert_receiving_and_management
  on public.inventory
  for insert
  to authenticated
  with check (
    public.has_role(
      array['admin'::public.role_key, 'manager'::public.role_key, 'receiver'::public.role_key]
    )
  );

create policy inventory_update_receiving_and_management
  on public.inventory
  for update
  to authenticated
  using (
    public.has_role(
      array['admin'::public.role_key, 'manager'::public.role_key, 'receiver'::public.role_key]
    )
  )
  with check (
    public.has_role(
      array['admin'::public.role_key, 'manager'::public.role_key, 'receiver'::public.role_key]
    )
  );

create policy inventory_delete_admin_manager
  on public.inventory
  for delete
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy orders_read_active_users
  on public.orders
  for select
  to authenticated
  using (public.is_active_app_user());

create policy orders_manage_admin_manager
  on public.orders
  for all
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]))
  with check (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy order_items_read_active_users
  on public.order_items
  for select
  to authenticated
  using (public.is_active_app_user());

create policy order_items_manage_admin_manager
  on public.order_items
  for all
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]))
  with check (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy tasks_read_accessible_roles
  on public.tasks
  for select
  to authenticated
  using (public.can_access_task(type, assignee_id));

create policy tasks_update_accessible_roles
  on public.tasks
  for update
  to authenticated
  using (public.can_access_task(type, assignee_id))
  with check (public.can_access_task(type, assignee_id));

create policy tasks_manage_admin_manager
  on public.tasks
  for insert
  to authenticated
  with check (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy tasks_delete_admin_manager
  on public.tasks
  for delete
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy shipments_read_fulfillment_roles
  on public.shipments
  for select
  to authenticated
  using (
    public.has_role(
      array[
        'admin'::public.role_key,
        'manager'::public.role_key,
        'picker'::public.role_key,
        'packer'::public.role_key
      ]
    )
  );

create policy shipments_insert_admin_manager_packer
  on public.shipments
  for insert
  to authenticated
  with check (
    public.has_role(
      array['admin'::public.role_key, 'manager'::public.role_key, 'packer'::public.role_key]
    )
  );

create policy shipments_update_admin_manager_packer
  on public.shipments
  for update
  to authenticated
  using (
    public.has_role(
      array['admin'::public.role_key, 'manager'::public.role_key, 'packer'::public.role_key]
    )
  )
  with check (
    public.has_role(
      array['admin'::public.role_key, 'manager'::public.role_key, 'packer'::public.role_key]
    )
  );

create policy shipments_delete_admin_manager
  on public.shipments
  for delete
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy returns_read_receiver_and_management
  on public.returns
  for select
  to authenticated
  using (
    public.has_role(
      array['admin'::public.role_key, 'manager'::public.role_key, 'receiver'::public.role_key]
    )
  );

create policy returns_insert_receiver_and_management
  on public.returns
  for insert
  to authenticated
  with check (
    public.has_role(
      array['admin'::public.role_key, 'manager'::public.role_key, 'receiver'::public.role_key]
    )
  );

create policy returns_update_receiver_and_management
  on public.returns
  for update
  to authenticated
  using (
    public.has_role(
      array['admin'::public.role_key, 'manager'::public.role_key, 'receiver'::public.role_key]
    )
  )
  with check (
    public.has_role(
      array['admin'::public.role_key, 'manager'::public.role_key, 'receiver'::public.role_key]
    )
  );

create policy returns_delete_admin_manager
  on public.returns
  for delete
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy integrations_read_admin_manager
  on public.integrations
  for select
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy integrations_manage_admin
  on public.integrations
  for all
  to authenticated
  using (public.has_role(array['admin'::public.role_key]))
  with check (public.has_role(array['admin'::public.role_key]));

create policy inventory_movements_read_admin_manager
  on public.inventory_movements
  for select
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy inventory_movements_insert_active_actor
  on public.inventory_movements
  for insert
  to authenticated
  with check (public.can_write_actor_row(actor_id));

create policy audit_logs_read_admin_manager
  on public.audit_logs
  for select
  to authenticated
  using (public.has_role(array['admin'::public.role_key, 'manager'::public.role_key]));

create policy audit_logs_insert_active_actor
  on public.audit_logs
  for insert
  to authenticated
  with check (public.can_write_actor_row(actor_id));
