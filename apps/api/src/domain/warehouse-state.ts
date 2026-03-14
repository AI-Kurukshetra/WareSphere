import {
  productCatalog,
  productCatalogResponseSchema,
  receiveStockInputSchema,
  receivingActionResponseSchema,
  receivingQueueResponseSchema,
  receivingTasks,
  inventoryOverviewResponseSchema,
  inventoryRecords,
  type DashboardMetric,
  type InventoryRecord,
  type Product,
  type PutawayInput,
  type ReceiveStockInput,
  type ReceivingTask,
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
  confirmReceipt: (input: ReceiveStockInput, actor?: AuthenticatedActor | null) => Awaitable<{
    task: ReceivingTask;
    inventoryRecord: InventoryRecord;
  }>;
  getDashboardMetrics: () => Awaitable<DashboardMetric[]>;
  listInventory: () => Awaitable<InventoryRecord[]>;
  listProducts: () => Awaitable<Product[]>;
  listReceivingTasks: () => Awaitable<ReceivingTask[]>;
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

  function getDashboardMetrics(): DashboardMetric[] {
    const totalAllocated = inventory.reduce((sum, record) => sum + record.allocatedQuantity, 0);
    const totalAvailable = inventory.reduce(
      (sum, record) =>
        sum + (record.onHandQuantity - record.allocatedQuantity - record.damagedQuantity),
      0
    );
    const totalReceived = tasks.reduce((sum, task) => sum + task.receivedQuantity, 0);
    const openTasks = tasks.filter((task) => task.status !== "completed").length;
    const exceptionCount = tasks.filter((task) => task.status === "blocked").length;

    return [
      {
        id: "orders",
        label: "Allocated stock",
        value: `${totalAllocated} units`,
        change: `${openTasks} receiving tasks active`,
        emphasis: openTasks > 0 ? "warning" : "stable"
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
        label: "Received this shift",
        value: `${totalReceived} units`,
        change: `${tasks.filter((task) => task.status === "in_progress").length} tasks staged`,
        emphasis: "stable"
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

  return {
    confirmReceipt,
    getDashboardMetrics,
    listInventory,
    listProducts,
    listReceivingTasks,
    putAway
  };
}
