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
export const returnDispositions = ["restock", "quarantine", "damage"] as const;
export const productStatuses = ["active", "inactive", "blocked"] as const;

export const roleSchema = z.enum(roleKeys);
export const orderStatusSchema = z.enum(orderStatuses);
export const taskTypeSchema = z.enum(taskTypes);
export const taskStatusSchema = z.enum(taskStatuses);
export const shipmentStatusSchema = z.enum(shipmentStatuses);
export const returnStatusSchema = z.enum(returnStatuses);
export const returnDispositionSchema = z.enum(returnDispositions);
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

export const orderLineSchema = z.object({
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  orderedQuantity: z.number().int().positive(),
  allocatedQuantity: z.number().int().nonnegative(),
  pickedQuantity: z.number().int().nonnegative(),
  packedQuantity: z.number().int().nonnegative()
});

export const orderSummarySchema = z.object({
  id: z.string(),
  sourceChannel: z.string(),
  status: orderStatusSchema,
  customerName: z.string(),
  customerEmail: z.string().nullable(),
  requestedShipAt: z.string().nullable(),
  lineCount: z.number().int().nonnegative(),
  unitsOrdered: z.number().int().nonnegative(),
  unitsAllocated: z.number().int().nonnegative(),
  unitsPicked: z.number().int().nonnegative(),
  unitsPacked: z.number().int().nonnegative(),
  hasException: z.boolean(),
  items: z.array(orderLineSchema)
});

export const pickingTaskSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  sourceChannel: z.string(),
  customerName: z.string(),
  productId: z.string(),
  sku: z.string(),
  barcode: z.string(),
  productName: z.string(),
  sourceBin: z.string(),
  expectedQuantity: z.number().int().positive(),
  pickedQuantity: z.number().int().nonnegative(),
  status: taskStatusSchema,
  assigneeName: z.string().nullable()
});

export const packingTaskSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  sourceChannel: z.string(),
  customerName: z.string(),
  expectedQuantity: z.number().int().positive(),
  packedQuantity: z.number().int().nonnegative(),
  status: taskStatusSchema,
  assigneeName: z.string().nullable()
});

export const countTaskSchema = z.object({
  id: z.string(),
  productId: z.string(),
  sku: z.string(),
  barcode: z.string(),
  productName: z.string(),
  binCode: z.string(),
  expectedQuantity: z.number().int().nonnegative(),
  countedQuantity: z.number().int().nonnegative().nullable(),
  varianceQuantity: z.number().int().nullable(),
  status: taskStatusSchema,
  assigneeName: z.string().nullable()
});

export const shipmentSummarySchema = z.object({
  id: z.string(),
  orderId: z.string(),
  sourceChannel: z.string(),
  customerName: z.string(),
  status: shipmentStatusSchema,
  carrierCode: z.string().nullable(),
  serviceLevel: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  packageCount: z.number().int().positive(),
  packedAt: z.string().nullable(),
  dispatchedAt: z.string().nullable()
});

export const returnSummarySchema = z.object({
  id: z.string(),
  orderId: z.string(),
  sourceChannel: z.string(),
  customerName: z.string(),
  productId: z.string(),
  sku: z.string(),
  barcode: z.string(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  status: returnStatusSchema,
  disposition: returnDispositionSchema.nullable(),
  sourceReference: z.string().nullable(),
  destinationBin: z.string().nullable(),
  receivedAt: z.string().nullable()
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

export const allocateOrderInputSchema = z.object({
  orderId: z.string().min(1)
});

export const pickStockInputSchema = z.object({
  taskId: z.string().min(1),
  sourceBin: z.string().min(1),
  barcode: z.string().min(1),
  quantity: z.number().int().positive()
});

export const packOrderInputSchema = z.object({
  taskId: z.string().min(1),
  packageCount: z.number().int().positive()
});

export const dispatchShipmentInputSchema = z.object({
  shipmentId: z.string().min(1),
  carrierCode: z.string().min(1),
  serviceLevel: z.string().min(1),
  trackingNumber: z.string().min(1)
});

export const initiateReturnInputSchema = z.object({
  orderId: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  sourceReference: z.string().trim().min(1).nullable().optional()
});

export const processReturnInputSchema = z.object({
  returnId: z.string().min(1),
  barcode: z.string().min(1),
  disposition: returnDispositionSchema,
  destinationBin: z.string().min(1)
});

export const releaseCountTaskInputSchema = z.object({
  inventoryId: z.string().min(1)
});

export const confirmCountInputSchema = z.object({
  taskId: z.string().min(1),
  binCode: z.string().min(1),
  barcode: z.string().min(1),
  countedQuantity: z.number().int().nonnegative()
});

export const adjustInventoryInputSchema = z.object({
  inventoryId: z.string().min(1),
  quantityDelta: z.number().int().refine((value) => value !== 0, {
    message: "Quantity delta must not be zero."
  }),
  reasonCode: z.string().trim().min(2)
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

export const orderOverviewResponseSchema = z.object({
  orders: z.array(orderSummarySchema)
});

export const pickingQueueResponseSchema = z.object({
  tasks: z.array(pickingTaskSchema)
});

export const packingQueueResponseSchema = z.object({
  tasks: z.array(packingTaskSchema)
});

export const countQueueResponseSchema = z.object({
  tasks: z.array(countTaskSchema)
});

export const shipmentOverviewResponseSchema = z.object({
  shipments: z.array(shipmentSummarySchema)
});

export const returnOverviewResponseSchema = z.object({
  returns: z.array(returnSummarySchema)
});

export const receivingActionResponseSchema = z.object({
  task: receivingTaskSchema,
  inventoryRecord: inventoryRecordSchema
});

export const orderAllocationResponseSchema = z.object({
  order: orderSummarySchema,
  tasks: z.array(pickingTaskSchema)
});

export const pickingActionResponseSchema = z.object({
  task: pickingTaskSchema,
  order: orderSummarySchema,
  inventoryRecord: inventoryRecordSchema
});

export const packingActionResponseSchema = z.object({
  task: packingTaskSchema,
  order: orderSummarySchema,
  shipment: shipmentSummarySchema
});

export const shippingActionResponseSchema = z.object({
  shipment: shipmentSummarySchema,
  order: orderSummarySchema
});

export const returnInitiationResponseSchema = z.object({
  returnRequest: returnSummarySchema,
  order: orderSummarySchema
});

export const returnResolutionResponseSchema = z.object({
  returnRequest: returnSummarySchema,
  inventoryRecord: inventoryRecordSchema
});

export const countReleaseResponseSchema = z.object({
  task: countTaskSchema
});

export const countConfirmationResponseSchema = z.object({
  task: countTaskSchema,
  inventoryRecord: inventoryRecordSchema
});

export const inventoryAdjustmentResponseSchema = z.object({
  inventoryRecord: inventoryRecordSchema
});

export type DashboardMetric = z.infer<typeof dashboardMetricSchema>;
export type WorkflowCard = z.infer<typeof workflowCardSchema>;
export type Product = z.infer<typeof productSchema>;
export type InventoryRecord = z.infer<typeof inventoryRecordSchema>;
export type ReceivingTask = z.infer<typeof receivingTaskSchema>;
export type OrderLine = z.infer<typeof orderLineSchema>;
export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type PickingTask = z.infer<typeof pickingTaskSchema>;
export type PackingTask = z.infer<typeof packingTaskSchema>;
export type CountTask = z.infer<typeof countTaskSchema>;
export type ShipmentSummary = z.infer<typeof shipmentSummarySchema>;
export type ReturnSummary = z.infer<typeof returnSummarySchema>;
export type ApiRouteGroup = z.infer<typeof apiRouteGroupSchema>;
export type ReceiveStockInput = z.infer<typeof receiveStockInputSchema>;
export type PutawayInput = z.infer<typeof putawayInputSchema>;
export type AllocateOrderInput = z.infer<typeof allocateOrderInputSchema>;
export type PickStockInput = z.infer<typeof pickStockInputSchema>;
export type PackOrderInput = z.infer<typeof packOrderInputSchema>;
export type DispatchShipmentInput = z.infer<typeof dispatchShipmentInputSchema>;
export type InitiateReturnInput = z.infer<typeof initiateReturnInputSchema>;
export type ProcessReturnInput = z.infer<typeof processReturnInputSchema>;
export type ReleaseCountTaskInput = z.infer<typeof releaseCountTaskInputSchema>;
export type ConfirmCountInput = z.infer<typeof confirmCountInputSchema>;
export type AdjustInventoryInput = z.infer<typeof adjustInventoryInputSchema>;
export type RoleKey = z.infer<typeof roleSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type ReturnStatus = z.infer<typeof returnStatusSchema>;
export type ReturnDisposition = z.infer<typeof returnDispositionSchema>;
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
    id: "counts",
    title: "Run cycle counts",
    description: "Release bin counts, resolve variances, and correct stock with audit-backed adjustments.",
    href: "/counts",
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

export const orderSummaries: OrderSummary[] = [
  {
    id: "SHOP-1101",
    sourceChannel: "shopify",
    status: "new",
    customerName: "Anika Rao",
    customerEmail: "anika.rao@example.com",
    requestedShipAt: "2026-03-14T12:30:00.000Z",
    lineCount: 2,
    unitsOrdered: 3,
    unitsAllocated: 0,
    unitsPicked: 0,
    unitsPacked: 0,
    hasException: false,
    items: [
      {
        productId: "prod-chair",
        sku: "SKU-CHAIR-001",
        productName: "Axis Ergonomic Chair",
        orderedQuantity: 2,
        allocatedQuantity: 0,
        pickedQuantity: 0,
        packedQuantity: 0
      },
      {
        productId: "prod-lamp",
        sku: "SKU-LAMP-003",
        productName: "Halo Task Lamp",
        orderedQuantity: 1,
        allocatedQuantity: 0,
        pickedQuantity: 0,
        packedQuantity: 0
      }
    ]
  },
  {
    id: "WOO-2204",
    sourceChannel: "woocommerce",
    status: "allocated",
    customerName: "Rahul Mehta",
    customerEmail: "rahul.mehta@example.com",
    requestedShipAt: "2026-03-14T15:00:00.000Z",
    lineCount: 2,
    unitsOrdered: 7,
    unitsAllocated: 7,
    unitsPicked: 0,
    unitsPacked: 0,
    hasException: false,
    items: [
      {
        productId: "prod-chair",
        sku: "SKU-CHAIR-001",
        productName: "Axis Ergonomic Chair",
        orderedQuantity: 4,
        allocatedQuantity: 4,
        pickedQuantity: 0,
        packedQuantity: 0
      },
      {
        productId: "prod-desk",
        sku: "SKU-DESK-002",
        productName: "Northline Standing Desk",
        orderedQuantity: 3,
        allocatedQuantity: 3,
        pickedQuantity: 0,
        packedQuantity: 0
      }
    ]
  },
  {
    id: "SHOP-1188",
    sourceChannel: "shopify",
    status: "shipped",
    customerName: "Priya Nair",
    customerEmail: "priya.nair@example.com",
    requestedShipAt: "2026-03-13T09:15:00.000Z",
    lineCount: 1,
    unitsOrdered: 2,
    unitsAllocated: 2,
    unitsPicked: 2,
    unitsPacked: 2,
    hasException: false,
    items: [
      {
        productId: "prod-lamp",
        sku: "SKU-LAMP-003",
        productName: "Halo Task Lamp",
        orderedQuantity: 2,
        allocatedQuantity: 2,
        pickedQuantity: 2,
        packedQuantity: 2
      }
    ]
  }
];

export const pickingTasks: PickingTask[] = [
  {
    id: "PICK-WOO-2204-01",
    orderId: "WOO-2204",
    sourceChannel: "woocommerce",
    customerName: "Rahul Mehta",
    productId: "prod-chair",
    sku: "SKU-CHAIR-001",
    barcode: "8901000000011",
    productName: "Axis Ergonomic Chair",
    sourceBin: "B-01-02",
    expectedQuantity: 4,
    pickedQuantity: 0,
    status: "open",
    assigneeName: "Test Picker"
  },
  {
    id: "PICK-WOO-2204-02",
    orderId: "WOO-2204",
    sourceChannel: "woocommerce",
    customerName: "Rahul Mehta",
    productId: "prod-desk",
    sku: "SKU-DESK-002",
    barcode: "8901000000028",
    productName: "Northline Standing Desk",
    sourceBin: "B-03-07",
    expectedQuantity: 3,
    pickedQuantity: 0,
    status: "open",
    assigneeName: "Test Picker"
  }
];

export const packingTasks: PackingTask[] = [];

export const countTasks: CountTask[] = [];

export const shipmentSummaries: ShipmentSummary[] = [
  {
    id: "SHIP-SHOP-1188",
    orderId: "SHOP-1188",
    sourceChannel: "shopify",
    customerName: "Priya Nair",
    status: "dispatched",
    carrierCode: "delhivery",
    serviceLevel: "surface",
    trackingNumber: "TRK-SHOP1188",
    packageCount: 1,
    packedAt: "2026-03-13T08:40:00.000Z",
    dispatchedAt: "2026-03-13T09:05:00.000Z"
  }
];

export const returnSummaries: ReturnSummary[] = [];

export const apiRouteGroups: ApiRouteGroup[] = [
  { slug: "/auth", summary: "Identity and session management", owner: "admin" },
  { slug: "/products", summary: "Product catalog and barcode metadata", owner: "manager" },
  { slug: "/inventory", summary: "Stock balances and movement history", owner: "manager" },
  { slug: "/counts", summary: "Cycle count release, variance confirmation, and manual corrections", owner: "manager" },
  { slug: "/orders", summary: "Order import, allocation, and lifecycle", owner: "manager" },
  { slug: "/returns", summary: "Return intake, disposition, and stock recovery", owner: "receiver" },
  { slug: "/shipments", summary: "Packing, tracking, and dispatch confirmation", owner: "packer" },
  { slug: "/tasks", summary: "Operational warehouse work queues", owner: "receiver" },
  { slug: "/integrations", summary: "Commerce channel status and retry tracking", owner: "admin" }
];
