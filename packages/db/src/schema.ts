import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import {
  orderStatuses,
  productStatuses,
  returnStatuses,
  roleKeys,
  shipmentStatuses,
  taskStatuses,
  taskTypes
} from "@wms/shared";

export const roleKeyEnum = pgEnum("role_key", roleKeys);
export const orderStatusEnum = pgEnum("order_status", orderStatuses);
export const taskTypeEnum = pgEnum("task_type", taskTypes);
export const taskStatusEnum = pgEnum("task_status", taskStatuses);
export const shipmentStatusEnum = pgEnum("shipment_status", shipmentStatuses);
export const returnStatusEnum = pgEnum("return_status", returnStatuses);
export const productStatusEnum = pgEnum("product_status", productStatuses);
export const integrationStatusEnum = pgEnum("integration_status", [
  "connected",
  "degraded",
  "paused"
]);
export const integrationProviderEnum = pgEnum("integration_provider", ["shopify", "woocommerce"]);
export const movementTypeEnum = pgEnum("movement_type", [
  "receive",
  "putaway",
  "pick",
  "pack",
  "ship",
  "return",
  "count_adjustment",
  "manual_adjustment"
]);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const warehouses = pgTable("warehouses", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  ...auditColumns
});

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: roleKeyEnum("key").notNull().unique(),
  name: text("name").notNull(),
  ...auditColumns
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id),
  isActive: boolean("is_active").notNull().default(true),
  ...auditColumns
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode").unique(),
  name: text("name").notNull(),
  status: productStatusEnum("status").notNull().default("active"),
  unitOfMeasure: text("unit_of_measure").notNull().default("each"),
  weightKg: numeric("weight_kg", { precision: 10, scale: 3 }),
  lengthCm: numeric("length_cm", { precision: 10, scale: 2 }),
  widthCm: numeric("width_cm", { precision: 10, scale: 2 }),
  heightCm: numeric("height_cm", { precision: 10, scale: 2 }),
  ...auditColumns
});

export const zones = pgTable("zones", {
  id: uuid("id").defaultRandom().primaryKey(),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  ...auditColumns
});

export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  zoneId: uuid("zone_id")
    .notNull()
    .references(() => zones.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  ...auditColumns
});

export const bins = pgTable("bins", {
  id: uuid("id").defaultRandom().primaryKey(),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id),
  code: text("code").notNull(),
  kind: text("kind").notNull().default("storage"),
  isStaging: boolean("is_staging").notNull().default(false),
  ...auditColumns
});

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    binId: uuid("bin_id")
      .notNull()
      .references(() => bins.id),
    onHandQuantity: integer("on_hand_quantity").notNull().default(0),
    allocatedQuantity: integer("allocated_quantity").notNull().default(0),
    damagedQuantity: integer("damaged_quantity").notNull().default(0),
    ...auditColumns
  },
  (table) => ({
    inventoryUnique: uniqueIndex("inventory_warehouse_product_bin_idx").on(
      table.warehouseId,
      table.productId,
      table.binId
    )
  })
);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  externalReference: text("external_reference").notNull().unique(),
  sourceChannel: text("source_channel").notNull(),
  status: orderStatusEnum("status").notNull().default("new"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  requestedShipAt: timestamp("requested_ship_at", { withTimezone: true }),
  allocatedAt: timestamp("allocated_at", { withTimezone: true }),
  packedAt: timestamp("packed_at", { withTimezone: true }),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  ...auditColumns
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  sku: text("sku").notNull(),
  orderedQuantity: integer("ordered_quantity").notNull(),
  allocatedQuantity: integer("allocated_quantity").notNull().default(0),
  pickedQuantity: integer("picked_quantity").notNull().default(0),
  packedQuantity: integer("packed_quantity").notNull().default(0),
  ...auditColumns
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  type: taskTypeEnum("type").notNull(),
  status: taskStatusEnum("status").notNull().default("open"),
  orderId: uuid("order_id").references(() => orders.id),
  productId: uuid("product_id").references(() => products.id),
  sourceBinId: uuid("source_bin_id").references(() => bins.id),
  destinationBinId: uuid("destination_bin_id").references(() => bins.id),
  assigneeId: uuid("assignee_id").references(() => users.id),
  expectedQuantity: integer("expected_quantity").notNull().default(0),
  actualQuantity: integer("actual_quantity"),
  exceptionCode: text("exception_code"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...auditColumns
});

export const shipments = pgTable("shipments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  status: shipmentStatusEnum("status").notNull().default("draft"),
  carrierCode: text("carrier_code"),
  serviceLevel: text("service_level"),
  trackingNumber: text("tracking_number"),
  packageCount: integer("package_count").notNull().default(1),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  ...auditColumns
});

export const returns = pgTable("returns", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id),
  status: returnStatusEnum("status").notNull().default("initiated"),
  sourceReference: text("source_reference"),
  disposition: text("disposition"),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  ...auditColumns
});

export const integrations = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: integrationProviderEnum("provider").notNull(),
  status: integrationStatusEnum("status").notNull().default("connected"),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  ...auditColumns
});

export const inventoryMovements = pgTable("inventory_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  fromBinId: uuid("from_bin_id").references(() => bins.id),
  toBinId: uuid("to_bin_id").references(() => bins.id),
  movementType: movementTypeEnum("movement_type").notNull(),
  quantity: integer("quantity").notNull(),
  reasonCode: text("reason_code"),
  referenceType: text("reference_type").notNull(),
  referenceId: uuid("reference_id"),
  actorId: uuid("actor_id").references(() => users.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
