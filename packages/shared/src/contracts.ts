import { z } from "zod";

export const roleKeys = ["admin", "manager", "receiver", "picker", "packer"] as const;
export const orderStatuses = [
  "new",
  "allocated",
  "picking",
  "packed",
  "shipped",
  "cancelled",
  "exception"
] as const;
export const taskTypes = [
  "receiving",
  "putaway",
  "picking",
  "packing",
  "counting",
  "return"
] as const;
export const taskStatuses = [
  "open",
  "in_progress",
  "blocked",
  "completed",
  "cancelled"
] as const;
export const shipmentStatuses = ["draft", "packed", "dispatched", "failed"] as const;
export const returnStatuses = ["initiated", "received", "restocked", "disposed"] as const;
export const productStatuses = ["active", "inactive", "blocked"] as const;

export const roleSchema = z.enum(roleKeys);
export const orderStatusSchema = z.enum(orderStatuses);
export const taskTypeSchema = z.enum(taskTypes);
export const taskStatusSchema = z.enum(taskStatuses);
export const shipmentStatusSchema = z.enum(shipmentStatuses);
export const returnStatusSchema = z.enum(returnStatuses);
export const productStatusSchema = z.enum(productStatuses);
export const metricEmphasisSchema = z.enum(["stable", "positive", "warning"]);

export const dashboardMetricSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  change: z.string(),
  emphasis: metricEmphasisSchema
});

export const workflowCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  href: z.string(),
  owner: roleSchema
});

export const productSchema = z.object({
  id: z.string(),
  sku: z.string(),
  barcode: z.string(),
  name: z.string(),
  status: productStatusSchema,
  unitOfMeasure: z.string()
});

export const inventoryRecordSchema = z.object({
  id: z.string(),
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  binCode: z.string(),
  onHandQuantity: z.number().int().nonnegative(),
  allocatedQuantity: z.number().int().nonnegative(),
  damagedQuantity: z.number().int().nonnegative()
});

export const receivingTaskSchema = z.object({
  id: z.string(),
  productId: z.string(),
  sku: z.string(),
  barcode: z.string(),
  productName: z.string(),
  expectedQuantity: z.number().int().positive(),
  receivedQuantity: z.number().int().nonnegative(),
  stagingBin: z.string(),
  destinationBin: z.string(),
  status: taskStatusSchema
});

export const apiRouteGroupSchema = z.object({
  slug: z.string(),
  summary: z.string(),
  owner: roleSchema
});

export const receiveStockInputSchema = z.object({
  taskId: z.string(),
  barcode: z.string(),
  quantity: z.number().int().positive()
});

export const putawayInputSchema = z.object({
  taskId: z.string(),
  destinationBin: z.string().min(1)
});

export const dashboardResponseSchema = z.object({
  metrics: z.array(dashboardMetricSchema),
  generatedAt: z.string()
});

export const routeGroupsResponseSchema = z.object({
  groups: z.array(apiRouteGroupSchema)
});

export const productCatalogResponseSchema = z.object({
  products: z.array(productSchema)
});

export const inventoryOverviewResponseSchema = z.object({
  records: z.array(inventoryRecordSchema)
});

export const receivingQueueResponseSchema = z.object({
  tasks: z.array(receivingTaskSchema)
});

export const receivingActionResponseSchema = z.object({
  task: receivingTaskSchema,
  inventoryRecord: inventoryRecordSchema
});

export type DashboardMetric = z.infer<typeof dashboardMetricSchema>;
export type WorkflowCard = z.infer<typeof workflowCardSchema>;
export type Product = z.infer<typeof productSchema>;
export type InventoryRecord = z.infer<typeof inventoryRecordSchema>;
export type ReceivingTask = z.infer<typeof receivingTaskSchema>;
export type ApiRouteGroup = z.infer<typeof apiRouteGroupSchema>;
export type ReceiveStockInput = z.infer<typeof receiveStockInputSchema>;
export type PutawayInput = z.infer<typeof putawayInputSchema>;
export type RoleKey = z.infer<typeof roleSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type TaskType = z.infer<typeof taskTypeSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const dashboardMetrics: DashboardMetric[] = [
  {
    id: "orders",
    label: "Orders in motion",
    value: "148",
    change: "+12 since 08:00",
    emphasis: "positive"
  },
  {
    id: "inventory",
    label: "Inventory accuracy",
    value: "99.2%",
    change: "2 unresolved variances",
    emphasis: "warning"
  },
  {
    id: "receiving",
    label: "Receiving throughput",
    value: "36 pallets",
    change: "On pace for shift target",
    emphasis: "stable"
  },
  {
    id: "exceptions",
    label: "Open exceptions",
    value: "5",
    change: "1 short pick, 4 sync retries",
    emphasis: "warning"
  }
];

export const workflowCards: WorkflowCard[] = [
  {
    id: "receiving",
    title: "Receive and stage stock",
    description: "Scan inbound product, validate quantities, and generate put-away tasks.",
    href: "/receiving",
    owner: "receiver"
  },
  {
    id: "inventory",
    title: "Inspect inventory health",
    description: "Review bin balances, low-stock risks, and movement history.",
    href: "/inventory",
    owner: "manager"
  },
  {
    id: "orders",
    title: "Release and monitor picks",
    description: "Allocate imported orders and track fulfillment progress through dispatch.",
    href: "/orders",
    owner: "manager"
  },
  {
    id: "returns",
    title: "Process returns",
    description: "Record restock, quarantine, and damage decisions against shipped orders.",
    href: "/returns",
    owner: "receiver"
  }
];

export const productCatalog: Product[] = [
  {
    id: "prod-chair",
    sku: "SKU-CHAIR-001",
    barcode: "8901000000011",
    name: "Axis Ergonomic Chair",
    status: "active",
    unitOfMeasure: "each"
  },
  {
    id: "prod-desk",
    sku: "SKU-DESK-002",
    barcode: "8901000000028",
    name: "Northline Standing Desk",
    status: "active",
    unitOfMeasure: "each"
  },
  {
    id: "prod-lamp",
    sku: "SKU-LAMP-003",
    barcode: "8901000000035",
    name: "Halo Task Lamp",
    status: "active",
    unitOfMeasure: "each"
  }
];

export const inventoryRecords: InventoryRecord[] = [
  {
    id: "inv-chair-bulk",
    productId: "prod-chair",
    sku: "SKU-CHAIR-001",
    productName: "Axis Ergonomic Chair",
    binCode: "B-01-02",
    onHandQuantity: 48,
    allocatedQuantity: 10,
    damagedQuantity: 0
  },
  {
    id: "inv-desk-bulk",
    productId: "prod-desk",
    sku: "SKU-DESK-002",
    productName: "Northline Standing Desk",
    binCode: "B-03-07",
    onHandQuantity: 18,
    allocatedQuantity: 4,
    damagedQuantity: 0
  },
  {
    id: "inv-lamp-bulk",
    productId: "prod-lamp",
    sku: "SKU-LAMP-003",
    productName: "Halo Task Lamp",
    binCode: "B-04-01",
    onHandQuantity: 64,
    allocatedQuantity: 12,
    damagedQuantity: 1
  },
  {
    id: "inv-desk-stage",
    productId: "prod-desk",
    sku: "SKU-DESK-002",
    productName: "Northline Standing Desk",
    binCode: "STAGE-A2",
    onHandQuantity: 6,
    allocatedQuantity: 0,
    damagedQuantity: 0
  }
];

export const receivingTasks: ReceivingTask[] = [
  {
    id: "REC-1008",
    productId: "prod-chair",
    sku: "SKU-CHAIR-001",
    barcode: "8901000000011",
    productName: "Axis Ergonomic Chair",
    expectedQuantity: 24,
    receivedQuantity: 0,
    stagingBin: "STAGE-A1",
    destinationBin: "B-01-02",
    status: "open"
  },
  {
    id: "REC-1009",
    productId: "prod-desk",
    sku: "SKU-DESK-002",
    barcode: "8901000000028",
    productName: "Northline Standing Desk",
    expectedQuantity: 12,
    receivedQuantity: 6,
    stagingBin: "STAGE-A2",
    destinationBin: "B-03-07",
    status: "in_progress"
  }
];

export const apiRouteGroups: ApiRouteGroup[] = [
  { slug: "/auth", summary: "Identity and session management", owner: "admin" },
  { slug: "/products", summary: "Product catalog and barcode metadata", owner: "manager" },
  { slug: "/inventory", summary: "Stock balances and movement history", owner: "manager" },
  { slug: "/orders", summary: "Order import, allocation, and lifecycle", owner: "manager" },
  { slug: "/tasks", summary: "Operational warehouse work queues", owner: "receiver" },
  { slug: "/integrations", summary: "Commerce channel status and retry tracking", owner: "admin" }
];
