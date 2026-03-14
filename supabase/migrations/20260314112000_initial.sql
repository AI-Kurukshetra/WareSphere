create type role_key as enum ('admin', 'manager', 'receiver', 'picker', 'packer');
create type order_status as enum ('new', 'allocated', 'picking', 'packed', 'shipped', 'cancelled', 'exception');
create type task_type as enum ('receiving', 'putaway', 'picking', 'packing', 'counting', 'return');
create type task_status as enum ('open', 'in_progress', 'blocked', 'completed', 'cancelled');
create type shipment_status as enum ('draft', 'packed', 'dispatched', 'failed');
create type return_status as enum ('initiated', 'received', 'restocked', 'disposed');
create type product_status as enum ('active', 'inactive', 'blocked');
create type integration_status as enum ('connected', 'degraded', 'paused');
create type integration_provider as enum ('shopify', 'woocommerce');
create type movement_type as enum (
  'receive',
  'putaway',
  'pick',
  'pack',
  'ship',
  'return',
  'count_adjustment',
  'manual_adjustment'
);

create table warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  key role_key not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  email text not null unique,
  display_name text not null,
  role_id uuid not null references roles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  barcode text unique,
  name text not null,
  status product_status not null default 'active',
  unit_of_measure text not null default 'each',
  weight_kg numeric(10, 3),
  length_cm numeric(10, 2),
  width_cm numeric(10, 2),
  height_cm numeric(10, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table zones (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references warehouses(id),
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references warehouses(id),
  zone_id uuid not null references zones(id),
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table bins (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references warehouses(id),
  location_id uuid not null references locations(id),
  code text not null,
  kind text not null default 'storage',
  is_staging boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inventory (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references warehouses(id),
  product_id uuid not null references products(id),
  bin_id uuid not null references bins(id),
  on_hand_quantity integer not null default 0,
  allocated_quantity integer not null default 0,
  damaged_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index inventory_warehouse_product_bin_idx
  on inventory (warehouse_id, product_id, bin_id);

create table orders (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references warehouses(id),
  external_reference text not null unique,
  source_channel text not null,
  status order_status not null default 'new',
  customer_name text not null,
  customer_email text,
  requested_ship_at timestamptz,
  allocated_at timestamptz,
  packed_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  product_id uuid not null references products(id),
  sku text not null,
  ordered_quantity integer not null,
  allocated_quantity integer not null default 0,
  picked_quantity integer not null default 0,
  packed_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  warehouse_id uuid not null references warehouses(id),
  type task_type not null,
  status task_status not null default 'open',
  order_id uuid references orders(id),
  product_id uuid references products(id),
  source_bin_id uuid references bins(id),
  destination_bin_id uuid references bins(id),
  assignee_id uuid references users(id),
  expected_quantity integer not null default 0,
  actual_quantity integer,
  exception_code text,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  status shipment_status not null default 'draft',
  carrier_code text,
  service_level text,
  tracking_number text,
  package_count integer not null default 1,
  dispatched_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  status return_status not null default 'initiated',
  source_reference text,
  disposition text,
  received_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table integrations (
  id uuid primary key default gen_random_uuid(),
  provider integration_provider not null,
  status integration_status not null default 'connected',
  config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references warehouses(id),
  product_id uuid not null references products(id),
  from_bin_id uuid references bins(id),
  to_bin_id uuid references bins(id),
  movement_type movement_type not null,
  quantity integer not null,
  reason_code text,
  reference_type text not null,
  reference_id uuid,
  actor_id uuid references users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into roles (key, name)
values
  ('admin', 'Administrator'),
  ('manager', 'Warehouse Manager'),
  ('receiver', 'Receiver'),
  ('picker', 'Picker'),
  ('packer', 'Packer')
on conflict (key) do nothing;
