import {
  adjustInventoryInputSchema,
  allocateOrderInputSchema,
  confirmCountInputSchema,
  countConfirmationResponseSchema,
  countQueueResponseSchema,
  countReleaseResponseSchema,
  countTasks,
  dispatchShipmentInputSchema,
  initiateReturnInputSchema,
  inventoryAdjustmentResponseSchema,
  orderAllocationResponseSchema,
  orderOverviewResponseSchema,
  orderSummaries,
  packOrderInputSchema,
  packingActionResponseSchema,
  packingQueueResponseSchema,
  packingTasks,
  pickStockInputSchema,
  pickingActionResponseSchema,
  pickingQueueResponseSchema,
  pickingTasks,
  productCatalog,
  shipmentOverviewResponseSchema,
  shipmentSummaries,
  shippingActionResponseSchema,
  productCatalogResponseSchema,
  processReturnInputSchema,
  releaseCountTaskInputSchema,
  receiveStockInputSchema,
  receivingActionResponseSchema,
  receivingQueueResponseSchema,
  receivingTasks,
  inventoryOverviewResponseSchema,
  inventoryRecords,
  returnInitiationResponseSchema,
  returnOverviewResponseSchema,
  returnResolutionResponseSchema,
  returnSummaries,
  type AdjustInventoryInput,
  type DispatchShipmentInput,
  type ConfirmCountInput,
  type CountTask,
  type DashboardMetric,
  type InventoryRecord,
  type InitiateReturnInput,
  type OrderSummary,
  type PackingTask,
  type ShipmentSummary,
  type PickingTask,
  type Product,
  type ProcessReturnInput,
  type AllocateOrderInput,
  type PackOrderInput,
  type PickStockInput,
  type PutawayInput,
  type ReceiveStockInput,
  type ReceivingTask,
  type ReleaseCountTaskInput,
  type ReturnSummary,
  putawayInputSchema
} from "@wms/shared";

import type { AuthenticatedActor } from "../auth.js";

export class WarehouseDomainError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "WarehouseDomainError";
  }
}

export type Awaitable<T> = T | Promise<T>;

export type WarehouseState = {
  adjustInventory: (input: AdjustInventoryInput, actor?: AuthenticatedActor | null) => Awaitable<{
    inventoryRecord: InventoryRecord;
  }>;
  allocateOrder: (input: AllocateOrderInput, actor?: AuthenticatedActor | null) => Awaitable<{
    order: OrderSummary;
    tasks: PickingTask[];
  }>;
  confirmCount: (input: ConfirmCountInput, actor?: AuthenticatedActor | null) => Awaitable<{
    task: CountTask;
    inventoryRecord: InventoryRecord;
  }>;
  createReturn: (input: InitiateReturnInput, actor?: AuthenticatedActor | null) => Awaitable<{
    returnRequest: ReturnSummary;
    order: OrderSummary;
  }>;
  confirmReceipt: (input: ReceiveStockInput, actor?: AuthenticatedActor | null) => Awaitable<{
    task: ReceivingTask;
    inventoryRecord: InventoryRecord;
  }>;
  confirmPick: (input: PickStockInput, actor?: AuthenticatedActor | null) => Awaitable<{
    task: PickingTask;
    order: OrderSummary;
    inventoryRecord: InventoryRecord;
  }>;
  confirmPack: (input: PackOrderInput, actor?: AuthenticatedActor | null) => Awaitable<{
    task: PackingTask;
    order: OrderSummary;
    shipment: ShipmentSummary;
  }>;
  dispatchShipment: (input: DispatchShipmentInput, actor?: AuthenticatedActor | null) => Awaitable<{
    shipment: ShipmentSummary;
    order: OrderSummary;
  }>;
  getDashboardMetrics: () => Awaitable<DashboardMetric[]>;
  listInventory: () => Awaitable<InventoryRecord[]>;
  listCountTasks: () => Awaitable<CountTask[]>;
  listOrders: () => Awaitable<OrderSummary[]>;
  listPackingTasks: () => Awaitable<PackingTask[]>;
  listPickingTasks: () => Awaitable<PickingTask[]>;
  listProducts: () => Awaitable<Product[]>;
  listReceivingTasks: () => Awaitable<ReceivingTask[]>;
  listReturns: () => Awaitable<ReturnSummary[]>;
  listShipments: () => Awaitable<ShipmentSummary[]>;
  processReturn: (input: ProcessReturnInput, actor?: AuthenticatedActor | null) => Awaitable<{
    returnRequest: ReturnSummary;
    inventoryRecord: InventoryRecord;
  }>;
  releaseCountTask: (input: ReleaseCountTaskInput, actor?: AuthenticatedActor | null) => Awaitable<{
    task: CountTask;
  }>;
  putAway: (input: PutawayInput, actor?: AuthenticatedActor | null) => Awaitable<{
    task: ReceivingTask;
    inventoryRecord: InventoryRecord;
  }>;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createWarehouseState(): WarehouseState {
  const products = clone(productCatalog);
  const inventory = clone(inventoryRecords);
  const counts = clone(countTasks);
  const orders = clone(orderSummaries);
  const packTasks = clone(packingTasks);
  const pickTasks = clone(pickingTasks);
  const returns = clone(returnSummaries);
  const shipments = clone(shipmentSummaries);
  const tasks = clone(receivingTasks);

  function listProducts(): Product[] {
    return productCatalogResponseSchema.parse({
      products: products.toSorted((left, right) => left.sku.localeCompare(right.sku))
    }).products;
  }

  function listInventory(): InventoryRecord[] {
    return inventoryOverviewResponseSchema.parse({
      records: inventory.toSorted((left, right) => {
        if (left.binCode === right.binCode) {
          return left.sku.localeCompare(right.sku);
        }

        return left.binCode.localeCompare(right.binCode);
      })
    }).records;
  }

  function listReceivingTasks(): ReceivingTask[] {
    return receivingQueueResponseSchema.parse({
      tasks: tasks.toSorted((left, right) => left.id.localeCompare(right.id))
    }).tasks;
  }

  function listCountTasks(): CountTask[] {
    return countQueueResponseSchema.parse({
      tasks: counts.toSorted((left, right) => left.id.localeCompare(right.id))
    }).tasks;
  }

  function listOrders(): OrderSummary[] {
    return orderOverviewResponseSchema.parse({
      orders: orders.toSorted((left, right) => left.id.localeCompare(right.id))
    }).orders;
  }

  function listPickingTasks(): PickingTask[] {
    return pickingQueueResponseSchema.parse({
      tasks: pickTasks.toSorted((left, right) => left.id.localeCompare(right.id))
    }).tasks;
  }

  function listPackingTasks(): PackingTask[] {
    return packingQueueResponseSchema.parse({
      tasks: packTasks.toSorted((left, right) => left.id.localeCompare(right.id))
    }).tasks;
  }

  function listShipments(): ShipmentSummary[] {
    return shipmentOverviewResponseSchema.parse({
      shipments: shipments.toSorted((left, right) => left.orderId.localeCompare(right.orderId))
    }).shipments;
  }

  function listReturns(): ReturnSummary[] {
    return returnOverviewResponseSchema.parse({
      returns: returns.toSorted((left, right) => left.id.localeCompare(right.id))
    }).returns;
  }

  function getDashboardMetrics(): DashboardMetric[] {
    const totalAllocated = inventory.reduce((sum, record) => sum + record.allocatedQuantity, 0);
    const totalAvailable = inventory.reduce(
      (sum, record) =>
        sum + (record.onHandQuantity - record.allocatedQuantity - record.damagedQuantity),
      0
    );
    const totalReceived = tasks.reduce((sum, task) => sum + task.receivedQuantity, 0);
    const openReceivingTasks = tasks.filter((task) => task.status !== "completed").length;
    const openCountTasks = counts.filter((task) => task.status !== "completed").length;
    const exceptionCount =
      tasks.filter((task) => task.status === "blocked").length +
      counts.filter((task) => task.varianceQuantity !== null && task.varianceQuantity !== 0).length;

    return [
      {
        id: "orders",
        label: "Allocated stock",
        value: `${totalAllocated} units`,
        change: `${openReceivingTasks} receiving tasks active`,
        emphasis: openReceivingTasks > 0 ? "warning" : "stable"
      },
      {
        id: "inventory",
        label: "Available units",
        value: `${totalAvailable}`,
        change: `${inventory.length} bin balances live`,
        emphasis: "positive"
      },
      {
        id: "receiving",
        label: "Count queue",
        value: `${openCountTasks}`,
        change: `${totalReceived} units received this shift`,
        emphasis: openCountTasks > 0 ? "warning" : "stable"
      },
      {
        id: "exceptions",
        label: "Open exceptions",
        value: `${exceptionCount}`,
        change: exceptionCount > 0
          ? `${exceptionCount} task${exceptionCount === 1 ? "" : "s"} require attention`
          : "Barcode and quantity checks are clear",
        emphasis: exceptionCount > 0 ? "warning" : "positive"
      }
    ];
  }

  function confirmReceipt(input: ReceiveStockInput) {
    const parsed = receiveStockInputSchema.parse(input);
    const task = findTask(parsed.taskId);
    const product = findProduct(task.productId);

    if (task.status === "completed") {
      throw new WarehouseDomainError(409, `Task ${task.id} is already completed.`);
    }

    if (product.barcode !== parsed.barcode) {
      throw new WarehouseDomainError(409, "Scanned barcode does not match the receiving task.");
    }

    const remainingQuantity = task.expectedQuantity - task.receivedQuantity;

    if (parsed.quantity > remainingQuantity) {
      throw new WarehouseDomainError(
        409,
        `Quantity ${parsed.quantity} exceeds the remaining quantity of ${remainingQuantity}.`
      );
    }

    task.receivedQuantity += parsed.quantity;
    task.status = "in_progress";

    const stagingInventory = upsertInventoryRecord(task, task.stagingBin);
    stagingInventory.onHandQuantity += parsed.quantity;

    return receivingActionResponseSchema.parse({
      task,
      inventoryRecord: stagingInventory
    });
  }

  function releaseCountTask(input: ReleaseCountTaskInput) {
    const parsed = releaseCountTaskInputSchema.parse(input);
    const inventoryRecord = findInventoryRecord(parsed.inventoryId);

    const existing = counts.find(
      (candidate) =>
        candidate.productId === inventoryRecord.productId &&
        candidate.binCode === inventoryRecord.binCode &&
        candidate.status !== "completed" &&
        candidate.status !== "cancelled"
    );

    if (existing) {
      throw new WarehouseDomainError(
        409,
        `A count task for ${inventoryRecord.sku} in ${inventoryRecord.binCode} is already open.`
      );
    }

    const product = findProduct(inventoryRecord.productId);
    const countIndex =
      counts.filter(
        (candidate) =>
          candidate.productId === inventoryRecord.productId && candidate.binCode === inventoryRecord.binCode
      ).length + 1;
    const created: CountTask = {
      id: buildCountTaskCode(inventoryRecord.sku, inventoryRecord.binCode, countIndex),
      productId: inventoryRecord.productId,
      sku: inventoryRecord.sku,
      barcode: product.barcode,
      productName: inventoryRecord.productName,
      binCode: inventoryRecord.binCode,
      expectedQuantity: inventoryRecord.onHandQuantity,
      countedQuantity: null,
      varianceQuantity: null,
      status: "open",
      assigneeName: null
    };

    counts.push(created);

    return countReleaseResponseSchema.parse({
      task: created
    });
  }

  function confirmCount(input: ConfirmCountInput) {
    const parsed = confirmCountInputSchema.parse(input);
    const task = findCountTask(parsed.taskId);

    if (task.status === "completed") {
      throw new WarehouseDomainError(409, `Count task ${task.id} is already completed.`);
    }

    if (task.binCode !== parsed.binCode) {
      throw new WarehouseDomainError(
        409,
        `Scanned bin ${parsed.binCode} does not match the assigned bin ${task.binCode}.`
      );
    }

    if (task.barcode !== parsed.barcode) {
      throw new WarehouseDomainError(409, "Scanned barcode does not match the count task.");
    }

    const inventoryRecord = findInventoryRecordForProductBin(task.productId, task.binCode);
    const minimumOnHand = inventoryRecord.allocatedQuantity + inventoryRecord.damagedQuantity;

    if (parsed.countedQuantity < minimumOnHand) {
      throw new WarehouseDomainError(
        409,
        `Counted quantity ${parsed.countedQuantity} cannot be lower than allocated plus damaged stock (${minimumOnHand}).`
      );
    }

    inventoryRecord.onHandQuantity = parsed.countedQuantity;
    task.countedQuantity = parsed.countedQuantity;
    task.varianceQuantity = parsed.countedQuantity - task.expectedQuantity;
    task.status = "completed";

    return countConfirmationResponseSchema.parse({
      task,
      inventoryRecord
    });
  }

  function adjustInventory(input: AdjustInventoryInput) {
    const parsed = adjustInventoryInputSchema.parse(input);
    const inventoryRecord = findInventoryRecord(parsed.inventoryId);
    const nextOnHandQuantity = inventoryRecord.onHandQuantity + parsed.quantityDelta;
    const minimumOnHand = inventoryRecord.allocatedQuantity + inventoryRecord.damagedQuantity;

    if (nextOnHandQuantity < 0) {
      throw new WarehouseDomainError(409, "Manual adjustment cannot reduce inventory below zero.");
    }

    if (nextOnHandQuantity < minimumOnHand) {
      throw new WarehouseDomainError(
        409,
        `Manual adjustment cannot reduce on-hand quantity below allocated plus damaged stock (${minimumOnHand}).`
      );
    }

    inventoryRecord.onHandQuantity = nextOnHandQuantity;

    return inventoryAdjustmentResponseSchema.parse({
      inventoryRecord
    });
  }

  function allocateOrder(input: AllocateOrderInput) {
    const parsed = allocateOrderInputSchema.parse(input);
    const order = findOrder(parsed.orderId);

    if (order.status !== "new") {
      throw new WarehouseDomainError(409, `Order ${order.id} cannot be allocated from status ${order.status}.`);
    }

    const createdTasks: PickingTask[] = [];
    let taskIndex = pickTasks.filter((task) => task.orderId === order.id).length;

    for (const item of order.items) {
      const remainingQuantity = item.orderedQuantity - item.allocatedQuantity;

      if (remainingQuantity <= 0) {
        continue;
      }

      const candidateInventory = inventory
        .filter((record) => record.productId === item.productId)
        .toSorted((left, right) => left.binCode.localeCompare(right.binCode));
      const totalAvailable = candidateInventory.reduce(
        (sum, record) => sum + availableQuantity(record),
        0
      );

      if (totalAvailable < remainingQuantity) {
        throw new WarehouseDomainError(
          409,
          `Order ${order.id} does not have enough available inventory for ${item.sku}.`
        );
      }

      let quantityToAllocate = remainingQuantity;

      for (const record of candidateInventory) {
        if (quantityToAllocate === 0) {
          break;
        }

        const available = availableQuantity(record);

        if (available === 0) {
          continue;
        }

        const allocated = Math.min(quantityToAllocate, available);
        const product = findProduct(item.productId);

        record.allocatedQuantity += allocated;
        taskIndex += 1;

        const created: PickingTask = {
          id: buildPickingTaskCode(order.id, taskIndex),
          orderId: order.id,
          sourceChannel: order.sourceChannel,
          customerName: order.customerName,
          productId: item.productId,
          sku: item.sku,
          barcode: product.barcode,
          productName: item.productName,
          sourceBin: record.binCode,
          expectedQuantity: allocated,
          pickedQuantity: 0,
          status: "open",
          assigneeName: null
        };

        pickTasks.push(created);
        createdTasks.push(created);
        quantityToAllocate -= allocated;
      }

      item.allocatedQuantity = item.orderedQuantity;
    }

    order.status = "allocated";
    syncOrderTotals(order);

    return orderAllocationResponseSchema.parse({
      order,
      tasks: createdTasks
    });
  }

  function confirmPick(input: PickStockInput) {
    const parsed = pickStockInputSchema.parse(input);
    const task = findPickingTask(parsed.taskId);
    const order = findOrder(task.orderId);
    const product = findProduct(task.productId);

    if (task.status === "completed") {
      throw new WarehouseDomainError(409, `Picking task ${task.id} is already completed.`);
    }

    if (task.sourceBin !== parsed.sourceBin) {
      throw new WarehouseDomainError(
        409,
        `Scanned bin ${parsed.sourceBin} does not match the assigned bin ${task.sourceBin}.`
      );
    }

    if (product.barcode !== parsed.barcode) {
      throw new WarehouseDomainError(409, "Scanned barcode does not match the picking task.");
    }

    const remainingQuantity = task.expectedQuantity - task.pickedQuantity;

    if (parsed.quantity > remainingQuantity) {
      throw new WarehouseDomainError(
        409,
        `Quantity ${parsed.quantity} exceeds the remaining quantity of ${remainingQuantity}.`
      );
    }

    const sourceInventory = inventory.find(
      (record) => record.productId === task.productId && record.binCode === task.sourceBin
    );

    if (
      !sourceInventory ||
      sourceInventory.onHandQuantity < parsed.quantity ||
      sourceInventory.allocatedQuantity < parsed.quantity
    ) {
      throw new WarehouseDomainError(
        409,
        `Source bin ${task.sourceBin} does not contain enough allocated stock for ${task.id}.`
      );
    }

    const orderItem = order.items.find((item) => item.productId === task.productId);

    if (!orderItem) {
      throw new WarehouseDomainError(
        404,
        `Order ${order.id} does not contain a line for product ${task.productId}.`
      );
    }

    if (orderItem.pickedQuantity + parsed.quantity > orderItem.allocatedQuantity) {
      throw new WarehouseDomainError(
        409,
        `Order ${order.id} cannot pick more than the allocated quantity for ${orderItem.sku}.`
      );
    }

    sourceInventory.onHandQuantity -= parsed.quantity;
    sourceInventory.allocatedQuantity -= parsed.quantity;
    task.pickedQuantity += parsed.quantity;
    task.status = task.pickedQuantity === task.expectedQuantity ? "completed" : "in_progress";
    orderItem.pickedQuantity += parsed.quantity;
    order.status = "picking";
    syncOrderTotals(order);
    releasePackingTaskIfReady(order);

    return pickingActionResponseSchema.parse({
      task,
      order,
      inventoryRecord: sourceInventory
    });
  }

  function confirmPack(input: PackOrderInput) {
    const parsed = packOrderInputSchema.parse(input);
    const task = findPackingTask(parsed.taskId);
    const order = findOrder(task.orderId);

    if (task.status === "completed") {
      throw new WarehouseDomainError(409, `Packing task ${task.id} is already completed.`);
    }

    if (!isOrderReadyForPacking(order)) {
      throw new WarehouseDomainError(
        409,
        `Order ${order.id} is not ready for packing until all pick work is complete.`
      );
    }

    const quantityPendingPack = order.items.reduce(
      (sum, item) => sum + Math.max(item.pickedQuantity - item.packedQuantity, 0),
      0
    );

    if (quantityPendingPack === 0) {
      throw new WarehouseDomainError(409, `Order ${order.id} has no picked units waiting for packing.`);
    }

    for (const item of order.items) {
      item.packedQuantity = item.pickedQuantity;
    }

    task.expectedQuantity = order.items.reduce((sum, item) => sum + item.pickedQuantity, 0);
    task.packedQuantity = task.expectedQuantity;
    task.status = "completed";

    order.status = "packed";
    syncOrderTotals(order);

    const shipment = upsertShipment(order);
    shipment.status = "packed";
    shipment.packageCount = parsed.packageCount;
    shipment.packedAt = new Date().toISOString();

    return packingActionResponseSchema.parse({
      task,
      order,
      shipment
    });
  }

  function dispatchShipment(input: DispatchShipmentInput) {
    const parsed = dispatchShipmentInputSchema.parse(input);
    const shipment = findShipment(parsed.shipmentId);
    const order = findOrder(shipment.orderId);

    if (shipment.status !== "packed") {
      throw new WarehouseDomainError(
        409,
        `Shipment ${shipment.id} cannot be dispatched from status ${shipment.status}.`
      );
    }

    if (order.status !== "packed") {
      throw new WarehouseDomainError(
        409,
        `Order ${order.id} must be packed before dispatch is confirmed.`
      );
    }

    shipment.status = "dispatched";
    shipment.carrierCode = parsed.carrierCode;
    shipment.serviceLevel = parsed.serviceLevel;
    shipment.trackingNumber = parsed.trackingNumber;
    shipment.dispatchedAt = new Date().toISOString();

    order.status = "shipped";
    syncOrderTotals(order);

    return shippingActionResponseSchema.parse({
      shipment,
      order
    });
  }

  function createReturn(input: InitiateReturnInput) {
    const parsed = initiateReturnInputSchema.parse(input);
    const order = findOrder(parsed.orderId);

    if (order.status !== "shipped") {
      throw new WarehouseDomainError(
        409,
        `Order ${order.id} must be shipped before a return can be created.`
      );
    }

    const orderItem = order.items.find((item) => item.sku === parsed.sku);

    if (!orderItem) {
      throw new WarehouseDomainError(
        404,
        `Order ${order.id} does not contain SKU ${parsed.sku}.`
      );
    }

    const committedQuantity = returns
      .filter((candidate) => candidate.orderId === order.id && candidate.sku === orderItem.sku)
      .reduce((sum, candidate) => sum + candidate.quantity, 0);
    const availableToReturn = orderItem.packedQuantity - committedQuantity;

    if (availableToReturn <= 0) {
      throw new WarehouseDomainError(
        409,
        `Order ${order.id} has no remaining returnable quantity for ${orderItem.sku}.`
      );
    }

    if (parsed.quantity > availableToReturn) {
      throw new WarehouseDomainError(
        409,
        `Quantity ${parsed.quantity} exceeds the remaining returnable quantity of ${availableToReturn}.`
      );
    }

    const product = findProduct(orderItem.productId);
    const created: ReturnSummary = {
      id: buildReturnCode(order.id, returns.length + 1),
      orderId: order.id,
      sourceChannel: order.sourceChannel,
      customerName: order.customerName,
      productId: orderItem.productId,
      sku: orderItem.sku,
      barcode: product.barcode,
      productName: orderItem.productName,
      quantity: parsed.quantity,
      status: "initiated",
      disposition: null,
      sourceReference: parsed.sourceReference ?? null,
      destinationBin: null,
      receivedAt: null
    };

    returns.push(created);

    return returnInitiationResponseSchema.parse({
      returnRequest: created,
      order
    });
  }

  function processReturn(input: ProcessReturnInput) {
    const parsed = processReturnInputSchema.parse(input);
    const returnRequest = findReturn(parsed.returnId);

    if (returnRequest.status === "restocked" || returnRequest.status === "disposed") {
      throw new WarehouseDomainError(409, `Return ${returnRequest.id} is already complete.`);
    }

    if (returnRequest.barcode !== parsed.barcode) {
      throw new WarehouseDomainError(409, "Scanned barcode does not match the return request.");
    }

    const inventoryRecord = upsertReturnInventoryRecord(
      returnRequest,
      parsed.destinationBin,
      parsed.disposition
    );

    returnRequest.disposition = parsed.disposition;
    returnRequest.destinationBin = parsed.destinationBin;
    returnRequest.receivedAt = new Date().toISOString();
    returnRequest.status = parsed.disposition === "restock" ? "restocked" : "disposed";

    return returnResolutionResponseSchema.parse({
      returnRequest,
      inventoryRecord
    });
  }

  function putAway(input: PutawayInput) {
    const parsed = putawayInputSchema.parse(input);
    const task = findTask(parsed.taskId);

    if (task.receivedQuantity === 0) {
      throw new WarehouseDomainError(409, `Task ${task.id} has no received quantity to put away.`);
    }

    if (task.status === "completed") {
      throw new WarehouseDomainError(409, `Task ${task.id} is already completed.`);
    }

    if (parsed.destinationBin !== task.destinationBin) {
      throw new WarehouseDomainError(
        409,
        `Destination bin ${parsed.destinationBin} does not match the assigned bin ${task.destinationBin}.`
      );
    }

    const stagingInventory = inventory.find(
      (record) => record.productId === task.productId && record.binCode === task.stagingBin
    );

    if (!stagingInventory || stagingInventory.onHandQuantity < task.receivedQuantity) {
      throw new WarehouseDomainError(
        409,
        `Staging bin ${task.stagingBin} does not contain enough stock for task ${task.id}.`
      );
    }

    stagingInventory.onHandQuantity -= task.receivedQuantity;

    const destinationInventory = upsertInventoryRecord(task, parsed.destinationBin);
    destinationInventory.onHandQuantity += task.receivedQuantity;
    task.status = "completed";

    return receivingActionResponseSchema.parse({
      task,
      inventoryRecord: destinationInventory
    });
  }

  function findTask(taskId: string) {
    const task = tasks.find((candidate) => candidate.id === taskId);

    if (!task) {
      throw new WarehouseDomainError(404, `Receiving task ${taskId} was not found.`);
    }

    return task;
  }

  function findOrder(orderId: string) {
    const order = orders.find((candidate) => candidate.id === orderId);

    if (!order) {
      throw new WarehouseDomainError(404, `Order ${orderId} was not found.`);
    }

    return order;
  }

  function findInventoryRecord(inventoryId: string) {
    const record = inventory.find((candidate) => candidate.id === inventoryId);

    if (!record) {
      throw new WarehouseDomainError(404, `Inventory record ${inventoryId} was not found.`);
    }

    return record;
  }

  function findInventoryRecordForProductBin(productId: string, binCode: string) {
    const record = inventory.find(
      (candidate) => candidate.productId === productId && candidate.binCode === binCode
    );

    if (!record) {
      throw new WarehouseDomainError(404, `Inventory record for ${productId} in ${binCode} was not found.`);
    }

    return record;
  }

  function findPickingTask(taskId: string) {
    const task = pickTasks.find((candidate) => candidate.id === taskId);

    if (!task) {
      throw new WarehouseDomainError(404, `Picking task ${taskId} was not found.`);
    }

    return task;
  }

  function findPackingTask(taskId: string) {
    const task = packTasks.find((candidate) => candidate.id === taskId);

    if (!task) {
      throw new WarehouseDomainError(404, `Packing task ${taskId} was not found.`);
    }

    return task;
  }

  function findShipment(shipmentId: string) {
    const shipment = shipments.find((candidate) => candidate.id === shipmentId);

    if (!shipment) {
      throw new WarehouseDomainError(404, `Shipment ${shipmentId} was not found.`);
    }

    return shipment;
  }

  function findCountTask(taskId: string) {
    const task = counts.find((candidate) => candidate.id === taskId);

    if (!task) {
      throw new WarehouseDomainError(404, `Count task ${taskId} was not found.`);
    }

    return task;
  }

  function findReturn(returnId: string) {
    const returnRequest = returns.find((candidate) => candidate.id === returnId);

    if (!returnRequest) {
      throw new WarehouseDomainError(404, `Return ${returnId} was not found.`);
    }

    return returnRequest;
  }

  function findProduct(productId: string) {
    const product = products.find((candidate) => candidate.id === productId);

    if (!product) {
      throw new WarehouseDomainError(404, `Product ${productId} was not found.`);
    }

    return product;
  }

  function upsertInventoryRecord(task: ReceivingTask, binCode: string) {
    const existing = inventory.find(
      (record) => record.productId === task.productId && record.binCode === binCode
    );

    if (existing) {
      return existing;
    }

    const created: InventoryRecord = {
      id: `inv-${task.productId}-${binCode.toLowerCase()}`,
      productId: task.productId,
      sku: task.sku,
      productName: task.productName,
      binCode,
      onHandQuantity: 0,
      allocatedQuantity: 0,
      damagedQuantity: 0
    };

    inventory.push(created);

    return created;
  }

  function upsertReturnInventoryRecord(
    returnRequest: ReturnSummary,
    binCode: string,
    disposition: "restock" | "quarantine" | "damage"
  ) {
    const existing = inventory.find(
      (record) => record.productId === returnRequest.productId && record.binCode === binCode
    );

    if (existing) {
      if (disposition === "restock") {
        existing.onHandQuantity += returnRequest.quantity;
      } else {
        existing.damagedQuantity += returnRequest.quantity;
      }

      return existing;
    }

    const created: InventoryRecord = {
      id: `inv-${returnRequest.productId}-${binCode.toLowerCase()}`,
      productId: returnRequest.productId,
      sku: returnRequest.sku,
      productName: returnRequest.productName,
      binCode,
      onHandQuantity: disposition === "restock" ? returnRequest.quantity : 0,
      allocatedQuantity: 0,
      damagedQuantity: disposition === "restock" ? 0 : returnRequest.quantity
    };

    inventory.push(created);

    return created;
  }

  function releasePackingTaskIfReady(order: OrderSummary) {
    if (!isOrderReadyForPacking(order)) {
      return;
    }

    const existing = packTasks.find((candidate) => candidate.orderId === order.id);

    if (existing) {
      existing.expectedQuantity = order.unitsPicked;
      return;
    }

    packTasks.push({
      id: buildPackingTaskCode(order.id),
      orderId: order.id,
      sourceChannel: order.sourceChannel,
      customerName: order.customerName,
      expectedQuantity: order.unitsPicked,
      packedQuantity: 0,
      status: "open",
      assigneeName: null
    });
  }

  function upsertShipment(order: OrderSummary) {
    const existing = shipments.find((candidate) => candidate.orderId === order.id);

    if (existing) {
      return existing;
    }

    const created: ShipmentSummary = {
      id: buildShipmentCode(order.id),
      orderId: order.id,
      sourceChannel: order.sourceChannel,
      customerName: order.customerName,
      status: "draft",
      carrierCode: null,
      serviceLevel: null,
      trackingNumber: null,
      packageCount: 1,
      packedAt: null,
      dispatchedAt: null
    };

    shipments.push(created);

    return created;
  }

  return {
    adjustInventory,
    allocateOrder,
    confirmCount,
    createReturn,
    confirmReceipt,
    confirmPick,
    confirmPack,
    dispatchShipment,
    getDashboardMetrics,
    listInventory,
    listCountTasks,
    listOrders,
    listPackingTasks,
    listPickingTasks,
    listProducts,
    listReceivingTasks,
    listReturns,
    listShipments,
    processReturn,
    releaseCountTask,
    putAway
  };
}

function availableQuantity(record: InventoryRecord) {
  return Math.max(record.onHandQuantity - record.allocatedQuantity - record.damagedQuantity, 0);
}

function syncOrderTotals(order: OrderSummary) {
  order.lineCount = order.items.length;
  order.unitsOrdered = order.items.reduce((sum, item) => sum + item.orderedQuantity, 0);
  order.unitsAllocated = order.items.reduce((sum, item) => sum + item.allocatedQuantity, 0);
  order.unitsPicked = order.items.reduce((sum, item) => sum + item.pickedQuantity, 0);
  order.unitsPacked = order.items.reduce((sum, item) => sum + item.packedQuantity, 0);
  order.hasException = order.status === "exception";
}

function buildPickingTaskCode(orderId: string, taskIndex: number) {
  return `PICK-${orderId.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase()}-${String(taskIndex).padStart(2, "0")}`;
}

function buildPackingTaskCode(orderId: string) {
  return `PACK-${orderId.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase()}`;
}

function buildShipmentCode(orderId: string) {
  return `SHIP-${orderId.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase()}`;
}

function buildCountTaskCode(sku: string, binCode: string, countIndex: number) {
  return `COUNT-${sanitizeCodePart(sku)}-${sanitizeCodePart(binCode)}-${String(countIndex).padStart(2, "0")}`;
}

function buildReturnCode(orderId: string, returnIndex: number) {
  return `RET-${orderId.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase()}-${String(returnIndex).padStart(2, "0")}`;
}

function isOrderReadyForPacking(order: OrderSummary) {
  return order.items.every((item) => item.pickedQuantity >= item.orderedQuantity);
}

function sanitizeCodePart(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase();
}
