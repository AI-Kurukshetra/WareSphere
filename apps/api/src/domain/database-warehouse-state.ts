import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import {
  auditLogs,
  bins,
  getDb,
  inventory,
  inventoryMovements,
  orderItems,
  orders,
  products,
  returns,
  shipments,
  tasks,
  users
} from "@wms/db";
import {
  adjustInventoryInputSchema,
  allocateOrderInputSchema,
  confirmCountInputSchema,
  countConfirmationResponseSchema,
  countQueueResponseSchema,
  countReleaseResponseSchema,
  dispatchShipmentInputSchema,
  initiateReturnInputSchema,
  inventoryAdjustmentResponseSchema,
  inventoryOverviewResponseSchema,
  orderAllocationResponseSchema,
  orderOverviewResponseSchema,
  packOrderInputSchema,
  packingActionResponseSchema,
  packingQueueResponseSchema,
  pickStockInputSchema,
  pickingActionResponseSchema,
  pickingQueueResponseSchema,
  processReturnInputSchema,
  productCatalogResponseSchema,
  releaseCountTaskInputSchema,
  returnInitiationResponseSchema,
  returnOverviewResponseSchema,
  returnResolutionResponseSchema,
  shipmentOverviewResponseSchema,
  shippingActionResponseSchema,
  putawayInputSchema,
  receiveStockInputSchema,
  receivingActionResponseSchema,
  receivingQueueResponseSchema,
  type OrderSummary,
  type PackingTask,
  type PickingTask,
  type CountTask,
  type ReturnDisposition,
  type ReturnSummary,
  type ShipmentSummary,
  type DashboardMetric,
  type ReceivingTask,
  type OrderStatus,
  type TaskStatus
} from "@wms/shared";

import type { AuthenticatedActor } from "../auth.js";
import { type WarehouseState, WarehouseDomainError } from "./warehouse-state.js";

type DbClient = ReturnType<typeof getDb>;
type DbTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type DbExecutor = DbClient | DbTransaction;

type ReceivingTaskContext = {
  dbId: string;
  code: string;
  warehouseId: string;
  productId: string;
  sku: string;
  barcode: string;
  productName: string;
  expectedQuantity: number;
  receivedQuantity: number;
  stagingBinId: string;
  stagingBin: string;
  destinationBinId: string;
  destinationBin: string;
  status: TaskStatus;
};

type OrderItemContext = {
  dbId: string;
  productId: string;
  sku: string;
  barcode: string;
  productName: string;
  orderedQuantity: number;
  allocatedQuantity: number;
  pickedQuantity: number;
  packedQuantity: number;
};

type OrderContext = {
  dbId: string;
  warehouseId: string;
  externalReference: string;
  sourceChannel: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string | null;
  requestedShipAt: Date | null;
  items: OrderItemContext[];
};

type PickingTaskContext = {
  dbId: string;
  code: string;
  orderDbId: string;
  orderId: string;
  warehouseId: string;
  sourceChannel: string;
  customerName: string;
  productId: string;
  sku: string;
  barcode: string;
  productName: string;
  sourceBinId: string;
  sourceBin: string;
  expectedQuantity: number;
  pickedQuantity: number;
  status: TaskStatus;
  assigneeName: string | null;
};

type PackingTaskContext = {
  dbId: string;
  code: string;
  orderDbId: string;
  orderId: string;
  warehouseId: string;
  sourceChannel: string;
  customerName: string;
  expectedQuantity: number;
  packedQuantity: number;
  status: TaskStatus;
  assigneeName: string | null;
};

type CountTaskContext = {
  dbId: string;
  code: string;
  warehouseId: string;
  productId: string;
  sku: string;
  barcode: string;
  productName: string;
  sourceBinId: string;
  binCode: string;
  expectedQuantity: number;
  countedQuantity: number | null;
  status: TaskStatus;
  assigneeName: string | null;
};

type ShipmentContext = {
  dbId: string;
  orderDbId: string;
  orderId: string;
  sourceChannel: string;
  customerName: string;
  status: "draft" | "packed" | "dispatched" | "failed";
  carrierCode: string | null;
  serviceLevel: string | null;
  trackingNumber: string | null;
  packageCount: number;
  packedAt: Date | null;
  dispatchedAt: Date | null;
};

type ReturnContext = {
  dbId: string;
  orderDbId: string;
  orderId: string;
  warehouseId: string;
  sourceChannel: string;
  customerName: string;
  productId: string;
  sku: string;
  barcode: string;
  productName: string;
  quantity: number;
  status: "initiated" | "received" | "restocked" | "disposed";
  disposition: ReturnDisposition | null;
  sourceReference: string | null;
  destinationBin: string | null;
  receivedAt: Date | null;
};

type PersistedInventoryRecord = {
  id: string;
  onHandQuantity: number;
  allocatedQuantity: number;
  damagedQuantity: number;
};

type InventoryRecordContext = {
  id: string;
  warehouseId: string;
  productId: string;
  sku: string;
  barcode: string;
  productName: string;
  binId: string;
  binCode: string;
  onHandQuantity: number;
  allocatedQuantity: number;
  damagedQuantity: number;
};

type InventoryAllocationCandidate = {
  id: string;
  warehouseId: string;
  productId: string;
  binId: string;
  binCode: string;
  onHandQuantity: number;
  allocatedQuantity: number;
  damagedQuantity: number;
};

export function createDatabaseWarehouseState(): WarehouseState {
  const db = getDb();

  return {
    async listProducts() {
      const rows = await db
        .select({
          id: products.id,
          sku: products.sku,
          barcode: products.barcode,
          name: products.name,
          status: products.status,
          unitOfMeasure: products.unitOfMeasure
        })
        .from(products)
        .orderBy(asc(products.sku));

      return productCatalogResponseSchema.parse({
        products: rows.map((row) => ({
          ...row,
          barcode: row.barcode ?? ""
        }))
      }).products;
    },

    async listInventory() {
      const rows = await db
        .select({
          id: inventory.id,
          productId: products.id,
          sku: products.sku,
          productName: products.name,
          binCode: bins.code,
          onHandQuantity: inventory.onHandQuantity,
          allocatedQuantity: inventory.allocatedQuantity,
          damagedQuantity: inventory.damagedQuantity
        })
        .from(inventory)
        .innerJoin(products, eq(inventory.productId, products.id))
        .innerJoin(bins, eq(inventory.binId, bins.id))
        .orderBy(asc(bins.code), asc(products.sku));

      return inventoryOverviewResponseSchema.parse({
        records: rows
      }).records;
    },

    async listCountTasks() {
      return loadCountTasks(db);
    },

    async listReceivingTasks() {
      return loadReceivingTasks(db);
    },

    async listOrders() {
      return loadOrderSummaries(db);
    },

    async listPickingTasks() {
      return loadPickingTasks(db);
    },

    async listPackingTasks() {
      return loadPackingTasks(db);
    },

    async listShipments() {
      return loadShipmentSummaries(db);
    },

    async listReturns() {
      return loadReturnSummaries(db);
    },

    async getDashboardMetrics() {
      const [records, receivingTasks, countTasks, pickingTasks, exceptionCount] = await Promise.all([
        this.listInventory(),
        this.listReceivingTasks(),
        this.listCountTasks(),
        this.listPickingTasks(),
        queryExceptionCount(db)
      ]);

      const totalAllocated = records.reduce((sum, record) => sum + record.allocatedQuantity, 0);
      const totalAvailable = records.reduce(
        (sum, record) =>
          sum + (record.onHandQuantity - record.allocatedQuantity - record.damagedQuantity),
        0
      );
      const totalReceived = receivingTasks.reduce((sum, task) => sum + task.receivedQuantity, 0);

      return [
        {
          id: "orders",
          label: "Allocated stock",
          value: `${totalAllocated} units`,
          change: `${pickingTasks.filter((task) => task.status !== "completed").length} pick tasks queued`,
          emphasis: pickingTasks.some((task) => task.status !== "completed") ? "warning" : "stable"
        },
        {
          id: "inventory",
          label: "Available units",
          value: `${totalAvailable}`,
          change: `${records.length} bin balances live`,
          emphasis: "positive"
        },
        {
          id: "receiving",
          label: "Count queue",
          value: `${countTasks.filter((task) => task.status !== "completed").length}`,
          change: `${totalReceived} units received this shift`,
          emphasis: countTasks.some((task) => task.status !== "completed") ? "warning" : "stable"
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
      ] satisfies DashboardMetric[];
    },

    async releaseCountTask(input, actor?: AuthenticatedActor | null) {
      const parsed = releaseCountTaskInputSchema.parse(input);

      return db.transaction(async (tx) => {
        const record = await loadInventoryRecordContext(tx, parsed.inventoryId);
        const existing = await loadOpenCountTaskForInventoryTarget(
          tx,
          record.warehouseId,
          record.productId,
          record.binId
        );

        if (existing) {
          throw new WarehouseDomainError(
            409,
            `A count task for ${record.sku} in ${record.binCode} is already open.`
          );
        }

        const countIndex = await queryCountTaskSequence(tx, record.productId, record.binId);
        const taskCode = buildCountTaskCode(record.sku, record.binCode, countIndex);

        await tx.insert(tasks).values({
          code: taskCode,
          warehouseId: record.warehouseId,
          type: "counting",
          status: "open",
          orderId: null,
          productId: record.productId,
          sourceBinId: record.binId,
          destinationBinId: null,
          assigneeId: null,
          expectedQuantity: record.onHandQuantity,
          actualQuantity: null
        });

        await tx.insert(auditLogs).values({
          actorId: actor?.userId ?? null,
          action: "count.released",
          entityType: "task",
          entityId: taskCode,
          summary: `Released cycle count for ${record.sku} in ${record.binCode}.`,
          payload: {
            inventoryId: record.id,
            expectedQuantity: record.onHandQuantity,
            binCode: record.binCode
          }
        });

        const task = await loadCountTaskContext(tx, taskCode);

        return countReleaseResponseSchema.parse({
          task: toCountTask(task)
        });
      });
    },

    async confirmCount(input, actor?: AuthenticatedActor | null) {
      const parsed = confirmCountInputSchema.parse(input);

      return db.transaction(async (tx) => {
        const task = await loadCountTaskContext(tx, parsed.taskId);

        if (task.status === "completed") {
          throw new WarehouseDomainError(409, `Count task ${task.code} is already completed.`);
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

        const record = await loadInventoryRecordContextByTarget(
          tx,
          task.warehouseId,
          task.productId,
          task.sourceBinId
        );
        const minimumOnHand = record.allocatedQuantity + record.damagedQuantity;

        if (parsed.countedQuantity < minimumOnHand) {
          throw new WarehouseDomainError(
            409,
            `Counted quantity ${parsed.countedQuantity} cannot be lower than allocated plus damaged stock (${minimumOnHand}).`
          );
        }

        const varianceQuantity = parsed.countedQuantity - task.expectedQuantity;

        await tx
          .update(inventory)
          .set({
            onHandQuantity: parsed.countedQuantity,
            updatedAt: new Date()
          })
          .where(eq(inventory.id, record.id));

        await tx
          .update(tasks)
          .set({
            actualQuantity: parsed.countedQuantity,
            status: "completed",
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(tasks.id, task.dbId));

        if (varianceQuantity !== 0) {
          await tx.insert(inventoryMovements).values({
            warehouseId: task.warehouseId,
            productId: task.productId,
            fromBinId: varianceQuantity < 0 ? task.sourceBinId : null,
            toBinId: varianceQuantity > 0 ? task.sourceBinId : null,
            movementType: "count_adjustment",
            quantity: Math.abs(varianceQuantity),
            reasonCode: varianceQuantity > 0 ? "cycle_count_gain" : "cycle_count_shrink",
            referenceType: "task",
            referenceId: task.dbId,
            actorId: actor?.userId ?? null,
            metadata: {
              taskCode: task.code,
              expectedQuantity: task.expectedQuantity,
              countedQuantity: parsed.countedQuantity,
              varianceQuantity
            }
          });
        }

        await tx.insert(auditLogs).values({
          actorId: actor?.userId ?? null,
          action: "count.confirmed",
          entityType: "task",
          entityId: task.code,
          summary: `Confirmed ${parsed.countedQuantity} units in ${task.binCode} for ${task.sku}.`,
          payload: {
            expectedQuantity: task.expectedQuantity,
            countedQuantity: parsed.countedQuantity,
            varianceQuantity
          }
        });

        const refreshedTask = await loadCountTaskContext(tx, parsed.taskId);

        return countConfirmationResponseSchema.parse({
          task: toCountTask(refreshedTask),
          inventoryRecord: toInventoryRecord(
            {
              id: record.id,
              onHandQuantity: parsed.countedQuantity,
              allocatedQuantity: record.allocatedQuantity,
              damagedQuantity: record.damagedQuantity
            },
            task.binCode,
            task.productId,
            task.sku,
            task.productName
          )
        });
      });
    },

    async adjustInventory(input, actor?: AuthenticatedActor | null) {
      const parsed = adjustInventoryInputSchema.parse(input);

      return db.transaction(async (tx) => {
        const record = await loadInventoryRecordContext(tx, parsed.inventoryId);
        const nextOnHandQuantity = record.onHandQuantity + parsed.quantityDelta;
        const minimumOnHand = record.allocatedQuantity + record.damagedQuantity;

        if (nextOnHandQuantity < 0) {
          throw new WarehouseDomainError(409, "Manual adjustment cannot reduce inventory below zero.");
        }

        if (nextOnHandQuantity < minimumOnHand) {
          throw new WarehouseDomainError(
            409,
            `Manual adjustment cannot reduce on-hand quantity below allocated plus damaged stock (${minimumOnHand}).`
          );
        }

        await tx
          .update(inventory)
          .set({
            onHandQuantity: nextOnHandQuantity,
            updatedAt: new Date()
          })
          .where(eq(inventory.id, record.id));

        await tx.insert(inventoryMovements).values({
          warehouseId: record.warehouseId,
          productId: record.productId,
          fromBinId: parsed.quantityDelta < 0 ? record.binId : null,
          toBinId: parsed.quantityDelta > 0 ? record.binId : null,
          movementType: "manual_adjustment",
          quantity: Math.abs(parsed.quantityDelta),
          reasonCode: parsed.reasonCode,
          referenceType: "inventory",
          referenceId: record.id,
          actorId: actor?.userId ?? null,
          metadata: {
            binCode: record.binCode,
            quantityDelta: parsed.quantityDelta,
            previousOnHandQuantity: record.onHandQuantity,
            nextOnHandQuantity
          }
        });

        await tx.insert(auditLogs).values({
          actorId: actor?.userId ?? null,
          action: "inventory.adjusted",
          entityType: "inventory",
          entityId: record.id,
          summary: `Adjusted ${record.sku} in ${record.binCode} by ${parsed.quantityDelta} units.`,
          payload: {
            reasonCode: parsed.reasonCode,
            quantityDelta: parsed.quantityDelta,
            previousOnHandQuantity: record.onHandQuantity,
            nextOnHandQuantity
          }
        });

        return inventoryAdjustmentResponseSchema.parse({
          inventoryRecord: toInventoryRecord(
            {
              id: record.id,
              onHandQuantity: nextOnHandQuantity,
              allocatedQuantity: record.allocatedQuantity,
              damagedQuantity: record.damagedQuantity
            },
            record.binCode,
            record.productId,
            record.sku,
            record.productName
          )
        });
      });
    },

    async confirmReceipt(input, actor?: AuthenticatedActor | null) {
      const parsed = receiveStockInputSchema.parse(input);

      return db.transaction(async (tx) => {
        const task = await loadReceivingTaskContext(tx, parsed.taskId);
        const remainingQuantity = task.expectedQuantity - task.receivedQuantity;

        if (task.status === "completed") {
          throw new WarehouseDomainError(409, `Task ${task.code} is already completed.`);
        }

        if (task.barcode !== parsed.barcode) {
          throw new WarehouseDomainError(409, "Scanned barcode does not match the receiving task.");
        }

        if (parsed.quantity > remainingQuantity) {
          throw new WarehouseDomainError(
            409,
            `Quantity ${parsed.quantity} exceeds the remaining quantity of ${remainingQuantity}.`
          );
        }

        const nextReceivedQuantity = task.receivedQuantity + parsed.quantity;

        await tx
          .update(tasks)
          .set({
            actualQuantity: nextReceivedQuantity,
            status: "in_progress",
            updatedAt: new Date()
          })
          .where(eq(tasks.id, task.dbId));

        const stagingInventory = await upsertInventoryBalance(tx, {
          warehouseId: task.warehouseId,
          productId: task.productId,
          binId: task.stagingBinId,
          quantityDelta: parsed.quantity
        });

        await tx.insert(inventoryMovements).values({
          warehouseId: task.warehouseId,
          productId: task.productId,
          fromBinId: null,
          toBinId: task.stagingBinId,
          movementType: "receive",
          quantity: parsed.quantity,
          referenceType: "task",
          referenceId: task.dbId,
          metadata: {
            barcode: parsed.barcode,
            taskCode: task.code
          }
        });

        await tx.insert(auditLogs).values({
          actorId: actor?.userId ?? null,
          action: "receiving.confirmed",
          entityType: "task",
          entityId: task.code,
          summary: `Received ${parsed.quantity} units into ${task.stagingBin}.`,
          payload: {
            quantity: parsed.quantity,
            stagingBin: task.stagingBin
          }
        });

        return receivingActionResponseSchema.parse({
          task: toReceivingTask({
            ...task,
            receivedQuantity: nextReceivedQuantity,
            status: "in_progress"
          }),
          inventoryRecord: {
            id: stagingInventory.id,
            productId: task.productId,
            sku: task.sku,
            productName: task.productName,
            binCode: task.stagingBin,
            onHandQuantity: stagingInventory.onHandQuantity,
            allocatedQuantity: stagingInventory.allocatedQuantity,
            damagedQuantity: stagingInventory.damagedQuantity
          }
        });
      });
    },

    async putAway(input, actor?: AuthenticatedActor | null) {
      const parsed = putawayInputSchema.parse(input);

      return db.transaction(async (tx) => {
        const task = await loadReceivingTaskContext(tx, parsed.taskId);

        if (task.receivedQuantity === 0) {
          throw new WarehouseDomainError(409, `Task ${task.code} has no received quantity to put away.`);
        }

        if (task.status === "completed") {
          throw new WarehouseDomainError(409, `Task ${task.code} is already completed.`);
        }

        if (parsed.destinationBin !== task.destinationBin) {
          throw new WarehouseDomainError(
            409,
            `Destination bin ${parsed.destinationBin} does not match the assigned bin ${task.destinationBin}.`
          );
        }

        const stagingInventory = await loadInventoryBalance(
          tx,
          task.warehouseId,
          task.productId,
          task.stagingBinId
        );

        if (!stagingInventory || stagingInventory.onHandQuantity < task.receivedQuantity) {
          throw new WarehouseDomainError(
            409,
            `Staging bin ${task.stagingBin} does not contain enough stock for task ${task.code}.`
          );
        }

        await tx
          .update(inventory)
          .set({
            onHandQuantity: stagingInventory.onHandQuantity - task.receivedQuantity,
            updatedAt: new Date()
          })
          .where(eq(inventory.id, stagingInventory.id));

        const destinationInventory = await upsertInventoryBalance(tx, {
          warehouseId: task.warehouseId,
          productId: task.productId,
          binId: task.destinationBinId,
          quantityDelta: task.receivedQuantity
        });

        await tx
          .update(tasks)
          .set({
            status: "completed",
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(tasks.id, task.dbId));

        await tx.insert(inventoryMovements).values({
          warehouseId: task.warehouseId,
          productId: task.productId,
          fromBinId: task.stagingBinId,
          toBinId: task.destinationBinId,
          movementType: "putaway",
          quantity: task.receivedQuantity,
          referenceType: "task",
          referenceId: task.dbId,
          metadata: {
            taskCode: task.code
          }
        });

        await tx.insert(auditLogs).values({
          actorId: actor?.userId ?? null,
          action: "receiving.putaway_completed",
          entityType: "task",
          entityId: task.code,
          summary: `Moved ${task.receivedQuantity} units from ${task.stagingBin} to ${task.destinationBin}.`,
          payload: {
            destinationBin: task.destinationBin,
            sourceBin: task.stagingBin
          }
        });

        return receivingActionResponseSchema.parse({
          task: toReceivingTask({
            ...task,
            status: "completed"
          }),
          inventoryRecord: {
            id: destinationInventory.id,
            productId: task.productId,
            sku: task.sku,
            productName: task.productName,
            binCode: task.destinationBin,
            onHandQuantity: destinationInventory.onHandQuantity,
            allocatedQuantity: destinationInventory.allocatedQuantity,
            damagedQuantity: destinationInventory.damagedQuantity
          }
        });
      });
    },

    async allocateOrder(input, actor?: AuthenticatedActor | null) {
      const parsed = allocateOrderInputSchema.parse(input);

      return db.transaction(async (tx) => {
        const order = await loadOrderContext(tx, parsed.orderId);

        if (order.status !== "new") {
          throw new WarehouseDomainError(
            409,
            `Order ${order.externalReference} cannot be allocated from status ${order.status}.`
          );
        }

        const inventoryCandidates = await loadInventoryCandidates(
          tx,
          order.warehouseId,
          order.items.map((item) => item.productId)
        );
        const createdTaskCodes: string[] = [];
        let taskIndex = 0;

        for (const item of order.items) {
          const quantityToAllocate = item.orderedQuantity - item.allocatedQuantity;

          if (quantityToAllocate <= 0) {
            continue;
          }

          const candidates = inventoryCandidates
            .filter((candidate) => candidate.productId === item.productId)
            .toSorted((left, right) => left.binCode.localeCompare(right.binCode));
          const totalAvailable = candidates.reduce((sum, candidate) => sum + availableQuantity(candidate), 0);

          if (totalAvailable < quantityToAllocate) {
            throw new WarehouseDomainError(
              409,
              `Order ${order.externalReference} does not have enough available inventory for ${item.sku}.`
            );
          }

          let remaining = quantityToAllocate;

          for (const candidate of candidates) {
            if (remaining === 0) {
              break;
            }

            const available = availableQuantity(candidate);

            if (available === 0) {
              continue;
            }

            const allocated = Math.min(remaining, available);
            taskIndex += 1;
            candidate.allocatedQuantity += allocated;
            remaining -= allocated;

            await tx
              .update(inventory)
              .set({
                allocatedQuantity: candidate.allocatedQuantity,
                updatedAt: new Date()
              })
              .where(eq(inventory.id, candidate.id));

            const taskCode = buildPickingTaskCode(order.externalReference, taskIndex);
            createdTaskCodes.push(taskCode);

            await tx.insert(tasks).values({
              code: taskCode,
              warehouseId: order.warehouseId,
              type: "picking",
              status: "open",
              orderId: order.dbId,
              productId: item.productId,
              sourceBinId: candidate.binId,
              destinationBinId: null,
              assigneeId: null,
              expectedQuantity: allocated,
              actualQuantity: 0
            });
          }

          await tx
            .update(orderItems)
            .set({
              allocatedQuantity: item.orderedQuantity,
              updatedAt: new Date()
            })
            .where(eq(orderItems.id, item.dbId));
        }

        await tx
          .update(orders)
          .set({
            status: "allocated",
            allocatedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(orders.id, order.dbId));

        await tx.insert(auditLogs).values({
          actorId: actor?.userId ?? null,
          action: "orders.allocated",
          entityType: "order",
          entityId: order.externalReference,
          summary: `Reserved stock and released ${createdTaskCodes.length} pick tasks for ${order.externalReference}.`,
          payload: {
            taskCount: createdTaskCodes.length
          }
        });

        const refreshedOrder = await loadOrderSummaryByReference(tx, parsed.orderId);
        const createdTasks = await loadPickingTasksByCode(tx, createdTaskCodes);

        return orderAllocationResponseSchema.parse({
          order: refreshedOrder,
          tasks: createdTasks
        });
      });
    },

    async confirmPick(input, actor?: AuthenticatedActor | null) {
      const parsed = pickStockInputSchema.parse(input);

      return db.transaction(async (tx) => {
        const task = await loadPickingTaskContext(tx, parsed.taskId);
        const remainingQuantity = task.expectedQuantity - task.pickedQuantity;

        if (task.status === "completed") {
          throw new WarehouseDomainError(409, `Picking task ${task.code} is already completed.`);
        }

        if (task.sourceBin !== parsed.sourceBin) {
          throw new WarehouseDomainError(
            409,
            `Scanned bin ${parsed.sourceBin} does not match the assigned bin ${task.sourceBin}.`
          );
        }

        if (task.barcode !== parsed.barcode) {
          throw new WarehouseDomainError(409, "Scanned barcode does not match the picking task.");
        }

        if (parsed.quantity > remainingQuantity) {
          throw new WarehouseDomainError(
            409,
            `Quantity ${parsed.quantity} exceeds the remaining quantity of ${remainingQuantity}.`
          );
        }

        const sourceInventory = await loadInventoryBalance(
          tx,
          task.warehouseId,
          task.productId,
          task.sourceBinId
        );

        if (
          !sourceInventory ||
          sourceInventory.onHandQuantity < parsed.quantity ||
          sourceInventory.allocatedQuantity < parsed.quantity
        ) {
          throw new WarehouseDomainError(
            409,
            `Source bin ${task.sourceBin} does not contain enough allocated stock for task ${task.code}.`
          );
        }

        const nextPickedQuantity = task.pickedQuantity + parsed.quantity;
        const nextStatus = nextPickedQuantity === task.expectedQuantity ? "completed" : "in_progress";
        const orderLine = await loadOrderLineForPicking(tx, task.orderDbId, task.productId);

        if (orderLine.pickedQuantity + parsed.quantity > orderLine.allocatedQuantity) {
          throw new WarehouseDomainError(
            409,
            `Order ${task.orderId} cannot pick more than the allocated quantity for ${task.sku}.`
          );
        }

        await tx
          .update(inventory)
          .set({
            onHandQuantity: sourceInventory.onHandQuantity - parsed.quantity,
            allocatedQuantity: sourceInventory.allocatedQuantity - parsed.quantity,
            updatedAt: new Date()
          })
          .where(eq(inventory.id, sourceInventory.id));

        await tx
          .update(tasks)
          .set({
            actualQuantity: nextPickedQuantity,
            status: nextStatus,
            completedAt: nextStatus === "completed" ? new Date() : null,
            updatedAt: new Date()
          })
          .where(eq(tasks.id, task.dbId));

        await tx
          .update(orderItems)
          .set({
            pickedQuantity: orderLine.pickedQuantity + parsed.quantity,
            updatedAt: new Date()
          })
          .where(eq(orderItems.id, orderLine.dbId));

        await tx
          .update(orders)
          .set({
            status: "picking",
            updatedAt: new Date()
          })
          .where(eq(orders.id, task.orderDbId));

        const releasedPackingTask = await releasePackingTaskIfReady(tx, task.orderDbId);

        await tx.insert(inventoryMovements).values({
          warehouseId: task.warehouseId,
          productId: task.productId,
          fromBinId: task.sourceBinId,
          toBinId: null,
          movementType: "pick",
          quantity: parsed.quantity,
          referenceType: "task",
          referenceId: task.dbId,
          actorId: actor?.userId ?? null,
          metadata: {
            barcode: parsed.barcode,
            taskCode: task.code
          }
        });

        await tx.insert(auditLogs).values({
          actorId: actor?.userId ?? null,
          action: "picking.confirmed",
          entityType: "task",
          entityId: task.code,
          summary: `Picked ${parsed.quantity} units from ${task.sourceBin}.`,
          payload: {
            orderId: task.orderId,
            sourceBin: task.sourceBin,
            packingTaskCode: releasedPackingTask?.code ?? null
          }
        });

        const refreshedTask = await loadPickingTaskContext(tx, parsed.taskId);
        const refreshedOrder = await loadOrderSummaryByReference(tx, task.orderId);

        return pickingActionResponseSchema.parse({
          task: toPickingTask(refreshedTask),
          order: refreshedOrder,
          inventoryRecord: {
            id: sourceInventory.id,
            productId: task.productId,
            sku: task.sku,
            productName: task.productName,
            binCode: task.sourceBin,
            onHandQuantity: sourceInventory.onHandQuantity - parsed.quantity,
            allocatedQuantity: sourceInventory.allocatedQuantity - parsed.quantity,
            damagedQuantity: sourceInventory.damagedQuantity
          }
        });
      });
    },

    async confirmPack(input, actor?: AuthenticatedActor | null) {
      const parsed = packOrderInputSchema.parse(input);

      return db.transaction(async (tx) => {
        const task = await loadPackingTaskContext(tx, parsed.taskId);

        if (task.status === "completed") {
          throw new WarehouseDomainError(409, `Packing task ${task.code} is already completed.`);
        }

        const order = await loadOrderContextByDbId(tx, task.orderDbId);

        if (!isOrderReadyForPacking(order)) {
          throw new WarehouseDomainError(
            409,
            `Order ${task.orderId} is not ready for packing until all pick work is complete.`
          );
        }

        const pendingPackItems = order.items.filter((item) => item.pickedQuantity > item.packedQuantity);

        if (pendingPackItems.length === 0) {
          throw new WarehouseDomainError(
            409,
            `Order ${task.orderId} has no picked units waiting for packing.`
          );
        }

        for (const item of pendingPackItems) {
          await tx
            .update(orderItems)
            .set({
              packedQuantity: item.pickedQuantity,
              updatedAt: new Date()
            })
            .where(eq(orderItems.id, item.dbId));
        }

        const totalPackedQuantity = order.items.reduce((sum, item) => sum + item.pickedQuantity, 0);

        await tx
          .update(tasks)
          .set({
            actualQuantity: totalPackedQuantity,
            expectedQuantity: totalPackedQuantity,
            status: "completed",
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(tasks.id, task.dbId));

        await tx
          .update(orders)
          .set({
            status: "packed",
            packedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(orders.id, task.orderDbId));

        let shipment = await loadShipmentContextByOrderDbId(tx, task.orderDbId);

        if (shipment) {
          await tx
            .update(shipments)
            .set({
              status: "packed",
              packageCount: parsed.packageCount,
              updatedAt: new Date()
            })
            .where(eq(shipments.id, shipment.dbId));
        } else {
          const inserted = await tx
            .insert(shipments)
            .values({
              orderId: task.orderDbId,
              status: "packed",
              packageCount: parsed.packageCount,
              metadata: {}
            })
            .returning({
              id: shipments.id
            });

          const shipmentId = inserted[0]?.id;

          if (!shipmentId) {
            throw new WarehouseDomainError(500, "Failed to create a shipment record for the packed order.");
          }

          shipment = await loadShipmentContext(tx, shipmentId);
        }

        if (!shipment) {
          throw new WarehouseDomainError(500, "Shipment context could not be resolved after packing.");
        }

        for (const item of pendingPackItems) {
          const quantity = item.pickedQuantity - item.packedQuantity;

          if (quantity <= 0) {
            continue;
          }

          await tx.insert(inventoryMovements).values({
            warehouseId: task.warehouseId,
            productId: item.productId,
            fromBinId: null,
            toBinId: null,
            movementType: "pack",
            quantity,
            referenceType: "shipment",
            referenceId: shipment.dbId,
            actorId: actor?.userId ?? null,
            metadata: {
              orderId: task.orderId,
              taskCode: task.code
            }
          });
        }

        await tx.insert(auditLogs).values({
          actorId: actor?.userId ?? null,
          action: "packing.confirmed",
          entityType: "task",
          entityId: task.code,
          summary: `Packed ${totalPackedQuantity} units for ${task.orderId} into ${parsed.packageCount} package${parsed.packageCount === 1 ? "" : "s"}.`,
          payload: {
            orderId: task.orderId,
            packageCount: parsed.packageCount
          }
        });

        const refreshedTask = await loadPackingTaskContext(tx, parsed.taskId);
        const refreshedOrder = await loadOrderSummaryByReference(tx, task.orderId);
        const refreshedShipment = await loadShipmentSummaryById(tx, shipment.dbId);

        return packingActionResponseSchema.parse({
          task: toPackingTask(refreshedTask),
          order: refreshedOrder,
          shipment: refreshedShipment
        });
      });
    },

    async dispatchShipment(input, actor?: AuthenticatedActor | null) {
      const parsed = dispatchShipmentInputSchema.parse(input);

      return db.transaction(async (tx) => {
        const shipment = await loadShipmentContext(tx, parsed.shipmentId);

        if (shipment.status !== "packed") {
          throw new WarehouseDomainError(
            409,
            `Shipment ${shipment.dbId} cannot be dispatched from status ${shipment.status}.`
          );
        }

        const order = await loadOrderContextByDbId(tx, shipment.orderDbId);

        if (order.status !== "packed") {
          throw new WarehouseDomainError(
            409,
            `Order ${shipment.orderId} must be packed before dispatch is confirmed.`
          );
        }

        if (order.items.some((item) => item.packedQuantity < item.orderedQuantity)) {
          throw new WarehouseDomainError(
            409,
            `Order ${shipment.orderId} still has lines waiting for packing.`
          );
        }

        await tx
          .update(shipments)
          .set({
            status: "dispatched",
            carrierCode: parsed.carrierCode,
            serviceLevel: parsed.serviceLevel,
            trackingNumber: parsed.trackingNumber,
            dispatchedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(shipments.id, shipment.dbId));

        await tx
          .update(orders)
          .set({
            status: "shipped",
            shippedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(orders.id, shipment.orderDbId));

        for (const item of order.items) {
          if (item.packedQuantity <= 0) {
            continue;
          }

          await tx.insert(inventoryMovements).values({
            warehouseId: order.warehouseId,
            productId: item.productId,
            fromBinId: null,
            toBinId: null,
            movementType: "ship",
            quantity: item.packedQuantity,
            referenceType: "shipment",
            referenceId: shipment.dbId,
            actorId: actor?.userId ?? null,
            metadata: {
              orderId: shipment.orderId,
              trackingNumber: parsed.trackingNumber
            }
          });
        }

        await tx.insert(auditLogs).values({
          actorId: actor?.userId ?? null,
          action: "shipping.dispatched",
          entityType: "shipment",
          entityId: shipment.dbId,
          summary: `Dispatched ${shipment.orderId} with tracking ${parsed.trackingNumber}.`,
          payload: {
            orderId: shipment.orderId,
            carrierCode: parsed.carrierCode,
            serviceLevel: parsed.serviceLevel,
            trackingNumber: parsed.trackingNumber
          }
        });

        const refreshedOrder = await loadOrderSummaryByReference(tx, shipment.orderId);
        const refreshedShipment = await loadShipmentSummaryById(tx, shipment.dbId);

        return shippingActionResponseSchema.parse({
          shipment: refreshedShipment,
          order: refreshedOrder
        });
      });
    },

    async createReturn(input, actor?: AuthenticatedActor | null) {
      const parsed = initiateReturnInputSchema.parse(input);

      return db.transaction(async (tx) => {
        const order = await loadOrderContext(tx, parsed.orderId);

        if (order.status !== "shipped") {
          throw new WarehouseDomainError(
            409,
            `Order ${order.externalReference} must be shipped before a return can be created.`
          );
        }

        const orderItem = order.items.find((item) => item.sku === parsed.sku);

        if (!orderItem) {
          throw new WarehouseDomainError(
            404,
            `Order ${order.externalReference} does not contain SKU ${parsed.sku}.`
          );
        }

        const committedQuantity = await queryCommittedReturnQuantity(tx, order.dbId, orderItem.productId);
        const availableToReturn = orderItem.packedQuantity - committedQuantity;

        if (availableToReturn <= 0) {
          throw new WarehouseDomainError(
            409,
            `Order ${order.externalReference} has no remaining returnable quantity for ${orderItem.sku}.`
          );
        }

        if (parsed.quantity > availableToReturn) {
          throw new WarehouseDomainError(
            409,
            `Quantity ${parsed.quantity} exceeds the remaining returnable quantity of ${availableToReturn}.`
          );
        }

        const inserted = await tx
          .insert(returns)
          .values({
            orderId: order.dbId,
            status: "initiated",
            sourceReference: parsed.sourceReference ?? null,
            disposition: null,
            receivedAt: null,
            metadata: {
              productId: orderItem.productId,
              sku: orderItem.sku,
              productName: orderItem.productName,
              barcode: orderItem.barcode,
              quantity: parsed.quantity,
              destinationBin: null
            }
          })
          .returning({
            id: returns.id
          });

        const returnId = inserted[0]?.id;

        if (!returnId) {
          throw new WarehouseDomainError(500, "Failed to create a return request.");
        }

        await tx.insert(auditLogs).values({
          actorId: actor?.userId ?? null,
          action: "return.initiated",
          entityType: "return",
          entityId: returnId,
          summary: `Created return request for ${order.externalReference} (${orderItem.sku} x ${parsed.quantity}).`,
          payload: {
            orderId: order.externalReference,
            sku: orderItem.sku,
            quantity: parsed.quantity,
            sourceReference: parsed.sourceReference ?? null
          }
        });

        const refreshedReturn = await loadReturnSummaryById(tx, returnId);
        const refreshedOrder = await loadOrderSummaryByReference(tx, order.externalReference);

        return returnInitiationResponseSchema.parse({
          returnRequest: refreshedReturn,
          order: refreshedOrder
        });
      });
    },

    async processReturn(input, actor?: AuthenticatedActor | null) {
      const parsed = processReturnInputSchema.parse(input);

      return db.transaction(async (tx) => {
        const returnRequest = await loadReturnContext(tx, parsed.returnId);

        if (returnRequest.status === "restocked" || returnRequest.status === "disposed") {
          throw new WarehouseDomainError(409, `Return ${returnRequest.dbId} is already complete.`);
        }

        if (returnRequest.barcode !== parsed.barcode) {
          throw new WarehouseDomainError(409, "Scanned barcode does not match the return request.");
        }

        const destinationBin = await loadBinByCode(tx, parsed.destinationBin);
        const movementMetadata = {
          orderId: returnRequest.orderId,
          disposition: parsed.disposition,
          sourceReference: returnRequest.sourceReference
        } satisfies Record<string, string | null>;

        const updatedBalance =
          parsed.disposition === "restock"
            ? await upsertInventoryBalance(tx, {
              warehouseId: returnRequest.warehouseId,
              productId: returnRequest.productId,
              binId: destinationBin.id,
              quantityDelta: returnRequest.quantity
            })
            : await upsertInventoryDamageBalance(tx, {
              warehouseId: returnRequest.warehouseId,
              productId: returnRequest.productId,
              binId: destinationBin.id,
              quantityDelta: returnRequest.quantity
            });

        await tx
          .update(returns)
          .set({
            status: parsed.disposition === "restock" ? "restocked" : "disposed",
            disposition: parsed.disposition,
            receivedAt: new Date(),
            metadata: {
              productId: returnRequest.productId,
              sku: returnRequest.sku,
              productName: returnRequest.productName,
              barcode: returnRequest.barcode,
              quantity: returnRequest.quantity,
              destinationBin: destinationBin.code
            },
            updatedAt: new Date()
          })
          .where(eq(returns.id, returnRequest.dbId));

        await tx.insert(inventoryMovements).values({
          warehouseId: returnRequest.warehouseId,
          productId: returnRequest.productId,
          fromBinId: null,
          toBinId: destinationBin.id,
          movementType: "return",
          quantity: returnRequest.quantity,
          reasonCode: parsed.disposition,
          referenceType: "return",
          referenceId: returnRequest.dbId,
          actorId: actor?.userId ?? null,
          metadata: movementMetadata
        });

        await tx.insert(auditLogs).values({
          actorId: actor?.userId ?? null,
          action: "return.processed",
          entityType: "return",
          entityId: returnRequest.dbId,
          summary: `Processed ${returnRequest.orderId} return for ${returnRequest.sku} into ${destinationBin.code} as ${parsed.disposition}.`,
          payload: {
            ...movementMetadata,
            destinationBin: destinationBin.code,
            quantity: returnRequest.quantity
          }
        });

        const refreshedReturn = await loadReturnSummaryById(tx, returnRequest.dbId);
        const inventoryRecord = toInventoryRecord(
          updatedBalance,
          destinationBin.code,
          returnRequest.productId,
          returnRequest.sku,
          returnRequest.productName
        );

        return returnResolutionResponseSchema.parse({
          returnRequest: refreshedReturn,
          inventoryRecord
        });
      });
    }
  };
}

async function queryExceptionCount(executor: DbExecutor): Promise<number> {
  const rows = await executor
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(tasks)
    .where(
      or(
        isNotNull(tasks.exceptionCode),
        eq(tasks.status, "blocked" as TaskStatus)
      )
    );

  return rows[0]?.count ?? 0;
}

async function queryCommittedReturnQuantity(
  executor: DbExecutor,
  orderDbId: string,
  productId: string
) {
  const rows = await executor
    .select({
      metadataProductId: sql<string>`coalesce(${returns.metadata} ->> 'productId', '')`,
      quantity: sql<number>`coalesce((${returns.metadata} ->> 'quantity')::integer, 0)`
    })
    .from(returns)
    .where(eq(returns.orderId, orderDbId));

  return rows
    .filter((row) => row.metadataProductId === productId)
    .reduce((sum, row) => sum + (row.quantity ?? 0), 0);
}

async function loadReturnSummaries(executor: DbExecutor): Promise<ReturnSummary[]> {
  const rows = await executor
    .select({
      dbId: returns.id,
      orderDbId: orders.id,
      orderId: orders.externalReference,
      warehouseId: orders.warehouseId,
      sourceChannel: orders.sourceChannel,
      customerName: orders.customerName,
      status: returns.status,
      disposition: returns.disposition,
      sourceReference: returns.sourceReference,
      receivedAt: returns.receivedAt,
      metadata: returns.metadata
    })
    .from(returns)
    .innerJoin(orders, eq(returns.orderId, orders.id))
    .orderBy(asc(returns.createdAt));

  return returnOverviewResponseSchema.parse({
    returns: rows.map((row) => toReturnSummary(toReturnContext(row)))
  }).returns;
}

async function loadReturnContext(executor: DbExecutor, returnId: string): Promise<ReturnContext> {
  const rows = await executor
    .select({
      dbId: returns.id,
      orderDbId: orders.id,
      orderId: orders.externalReference,
      warehouseId: orders.warehouseId,
      sourceChannel: orders.sourceChannel,
      customerName: orders.customerName,
      status: returns.status,
      disposition: returns.disposition,
      sourceReference: returns.sourceReference,
      receivedAt: returns.receivedAt,
      metadata: returns.metadata
    })
    .from(returns)
    .innerJoin(orders, eq(returns.orderId, orders.id))
    .where(eq(returns.id, returnId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new WarehouseDomainError(404, `Return ${returnId} was not found.`);
  }

  return toReturnContext(row);
}

async function loadReturnSummaryById(executor: DbExecutor, returnId: string) {
  return toReturnSummary(await loadReturnContext(executor, returnId));
}

async function loadCountTasks(executor: DbExecutor): Promise<CountTask[]> {
  const rows = await executor
    .select({
      dbId: tasks.id,
      code: tasks.code,
      warehouseId: tasks.warehouseId,
      productId: products.id,
      sku: products.sku,
      barcode: products.barcode,
      productName: products.name,
      sourceBinId: tasks.sourceBinId,
      binCode: bins.code,
      expectedQuantity: tasks.expectedQuantity,
      countedQuantity: tasks.actualQuantity,
      status: tasks.status,
      assigneeName: users.displayName
    })
    .from(tasks)
    .innerJoin(products, eq(tasks.productId, products.id))
    .innerJoin(bins, eq(tasks.sourceBinId, bins.id))
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(eq(tasks.type, "counting"))
    .orderBy(asc(tasks.code));

  return countQueueResponseSchema.parse({
    tasks: rows.map((row) => {
      if (!row.sourceBinId || !row.barcode) {
        throw new WarehouseDomainError(
          500,
          `Count task ${row.code} is missing a bin assignment or barcode metadata.`
        );
      }

      return toCountTask({
        dbId: row.dbId,
        code: row.code,
        warehouseId: row.warehouseId,
        productId: row.productId,
        sku: row.sku,
        barcode: row.barcode,
        productName: row.productName,
        sourceBinId: row.sourceBinId,
        binCode: row.binCode,
        expectedQuantity: row.expectedQuantity,
        countedQuantity: row.countedQuantity,
        status: row.status,
        assigneeName: row.assigneeName
      });
    })
  }).tasks;
}

async function loadCountTaskContext(executor: DbExecutor, taskCode: string): Promise<CountTaskContext> {
  const rows = await executor
    .select({
      dbId: tasks.id,
      code: tasks.code,
      warehouseId: tasks.warehouseId,
      productId: products.id,
      sku: products.sku,
      barcode: products.barcode,
      productName: products.name,
      sourceBinId: tasks.sourceBinId,
      binCode: bins.code,
      expectedQuantity: tasks.expectedQuantity,
      countedQuantity: tasks.actualQuantity,
      status: tasks.status,
      assigneeName: users.displayName
    })
    .from(tasks)
    .innerJoin(products, eq(tasks.productId, products.id))
    .innerJoin(bins, eq(tasks.sourceBinId, bins.id))
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(eq(tasks.type, "counting"), eq(tasks.code, taskCode)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new WarehouseDomainError(404, `Count task ${taskCode} was not found.`);
  }

  if (!row.sourceBinId || !row.barcode) {
    throw new WarehouseDomainError(
      500,
      `Count task ${row.code} is missing a bin assignment or barcode metadata.`
    );
  }

  return {
    dbId: row.dbId,
    code: row.code,
    warehouseId: row.warehouseId,
    productId: row.productId,
    sku: row.sku,
    barcode: row.barcode,
    productName: row.productName,
    sourceBinId: row.sourceBinId,
    binCode: row.binCode,
    expectedQuantity: row.expectedQuantity,
    countedQuantity: row.countedQuantity,
    status: row.status,
    assigneeName: row.assigneeName
  };
}

async function loadReceivingTasks(executor: DbExecutor): Promise<ReceivingTask[]> {
  const rows = await executor
    .select({
      dbId: tasks.id,
      code: tasks.code,
      warehouseId: tasks.warehouseId,
      productId: products.id,
      sku: products.sku,
      barcode: products.barcode,
      productName: products.name,
      expectedQuantity: tasks.expectedQuantity,
      receivedQuantity: tasks.actualQuantity,
      sourceBinId: tasks.sourceBinId,
      destinationBinId: tasks.destinationBinId,
      status: tasks.status
    })
    .from(tasks)
    .innerJoin(products, eq(tasks.productId, products.id))
    .where(eq(tasks.type, "receiving"))
    .orderBy(asc(tasks.code));

  if (rows.length === 0) {
    return [];
  }

  const binCodeMap = await loadBinCodeMap(
    executor,
    rows.flatMap((row) => [row.sourceBinId, row.destinationBinId].filter(isString))
  );

  return receivingQueueResponseSchema.parse({
    tasks: rows.map((row) => {
      if (!row.sourceBinId || !row.destinationBinId || !row.barcode) {
        throw new WarehouseDomainError(
          500,
          `Receiving task ${row.code} is missing bin configuration or barcode metadata.`
        );
      }

      const stagingBin = binCodeMap.get(row.sourceBinId);
      const destinationBin = binCodeMap.get(row.destinationBinId);

      if (!stagingBin || !destinationBin) {
        throw new WarehouseDomainError(
          500,
          `Receiving task ${row.code} references a bin that does not exist.`
        );
      }

      return toReceivingTask({
        dbId: row.dbId,
        code: row.code,
        warehouseId: row.warehouseId,
        productId: row.productId,
        sku: row.sku,
        barcode: row.barcode,
        productName: row.productName,
        expectedQuantity: row.expectedQuantity,
        receivedQuantity: row.receivedQuantity ?? 0,
        stagingBinId: row.sourceBinId,
        stagingBin,
        destinationBinId: row.destinationBinId,
        destinationBin,
        status: row.status
      });
    })
  }).tasks;
}

async function loadReceivingTaskContext(
  executor: DbExecutor,
  taskCode: string
): Promise<ReceivingTaskContext> {
  const rows = await executor
    .select({
      dbId: tasks.id,
      code: tasks.code,
      warehouseId: tasks.warehouseId,
      productId: products.id,
      sku: products.sku,
      barcode: products.barcode,
      productName: products.name,
      expectedQuantity: tasks.expectedQuantity,
      receivedQuantity: tasks.actualQuantity,
      sourceBinId: tasks.sourceBinId,
      destinationBinId: tasks.destinationBinId,
      status: tasks.status
    })
    .from(tasks)
    .innerJoin(products, eq(tasks.productId, products.id))
    .where(and(eq(tasks.type, "receiving"), eq(tasks.code, taskCode)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new WarehouseDomainError(404, `Receiving task ${taskCode} was not found.`);
  }

  if (!row.sourceBinId || !row.destinationBinId || !row.barcode) {
    throw new WarehouseDomainError(
      500,
      `Receiving task ${row.code} is missing bin configuration or barcode metadata.`
    );
  }

  const binCodeMap = await loadBinCodeMap(executor, [row.sourceBinId, row.destinationBinId]);
  const stagingBin = binCodeMap.get(row.sourceBinId);
  const destinationBin = binCodeMap.get(row.destinationBinId);

  if (!stagingBin || !destinationBin) {
    throw new WarehouseDomainError(
      500,
      `Receiving task ${row.code} references a bin that does not exist.`
    );
  }

  return {
    dbId: row.dbId,
    code: row.code,
    warehouseId: row.warehouseId,
    productId: row.productId,
    sku: row.sku,
    barcode: row.barcode,
    productName: row.productName,
    expectedQuantity: row.expectedQuantity,
    receivedQuantity: row.receivedQuantity ?? 0,
    stagingBinId: row.sourceBinId,
    stagingBin,
    destinationBinId: row.destinationBinId,
    destinationBin,
    status: row.status
  };
}

async function loadOrderSummaries(executor: DbExecutor): Promise<OrderSummary[]> {
  const rows = await executor
    .select({
      dbId: orders.id,
      warehouseId: orders.warehouseId,
      externalReference: orders.externalReference,
      sourceChannel: orders.sourceChannel,
      status: orders.status,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      requestedShipAt: orders.requestedShipAt,
      itemDbId: orderItems.id,
      productId: products.id,
      sku: orderItems.sku,
      barcode: products.barcode,
      productName: products.name,
      orderedQuantity: orderItems.orderedQuantity,
      allocatedQuantity: orderItems.allocatedQuantity,
      pickedQuantity: orderItems.pickedQuantity,
      packedQuantity: orderItems.packedQuantity
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .orderBy(asc(orders.externalReference), asc(orderItems.id));

  if (rows.length === 0) {
    return [];
  }

  const contexts = new Map<string, OrderContext>();

  for (const row of rows) {
    const existing =
      contexts.get(row.dbId) ??
      ({
        dbId: row.dbId,
        warehouseId: row.warehouseId,
        externalReference: row.externalReference,
        sourceChannel: row.sourceChannel,
        status: row.status,
        customerName: row.customerName,
        customerEmail: row.customerEmail,
        requestedShipAt: row.requestedShipAt,
        items: []
      } satisfies OrderContext);

    existing.items.push({
      dbId: row.itemDbId,
      productId: row.productId,
      sku: row.sku,
      barcode: row.barcode ?? "",
      productName: row.productName,
      orderedQuantity: row.orderedQuantity,
      allocatedQuantity: row.allocatedQuantity,
      pickedQuantity: row.pickedQuantity,
      packedQuantity: row.packedQuantity
    });

    contexts.set(row.dbId, existing);
  }

  return orderOverviewResponseSchema.parse({
    orders: [...contexts.values()].map(toOrderSummary)
  }).orders;
}

async function loadOrderSummaryByReference(executor: DbExecutor, orderReference: string) {
  const order = (await loadOrderSummaries(executor)).find((candidate) => candidate.id === orderReference);

  if (!order) {
    throw new WarehouseDomainError(404, `Order ${orderReference} was not found.`);
  }

  return order;
}

async function loadOrderContext(executor: DbExecutor, orderReference: string): Promise<OrderContext> {
  const rows = await executor
    .select({
      dbId: orders.id,
      warehouseId: orders.warehouseId,
      externalReference: orders.externalReference,
      sourceChannel: orders.sourceChannel,
      status: orders.status,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      requestedShipAt: orders.requestedShipAt,
      itemDbId: orderItems.id,
      productId: products.id,
      sku: orderItems.sku,
      barcode: products.barcode,
      productName: products.name,
      orderedQuantity: orderItems.orderedQuantity,
      allocatedQuantity: orderItems.allocatedQuantity,
      pickedQuantity: orderItems.pickedQuantity,
      packedQuantity: orderItems.packedQuantity
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orders.externalReference, orderReference))
    .orderBy(asc(orderItems.id));

  const firstRow = rows[0];

  if (!firstRow) {
    throw new WarehouseDomainError(404, `Order ${orderReference} was not found.`);
  }

  return {
    dbId: firstRow.dbId,
    warehouseId: firstRow.warehouseId,
    externalReference: firstRow.externalReference,
    sourceChannel: firstRow.sourceChannel,
    status: firstRow.status,
    customerName: firstRow.customerName,
    customerEmail: firstRow.customerEmail,
    requestedShipAt: firstRow.requestedShipAt,
    items: rows.map((row) => ({
      dbId: row.itemDbId,
      productId: row.productId,
      sku: row.sku,
      barcode: row.barcode ?? "",
      productName: row.productName,
      orderedQuantity: row.orderedQuantity,
      allocatedQuantity: row.allocatedQuantity,
      pickedQuantity: row.pickedQuantity,
      packedQuantity: row.packedQuantity
    }))
  };
}

async function loadOrderContextByDbId(executor: DbExecutor, orderDbId: string): Promise<OrderContext> {
  const rows = await executor
    .select({
      dbId: orders.id,
      warehouseId: orders.warehouseId,
      externalReference: orders.externalReference,
      sourceChannel: orders.sourceChannel,
      status: orders.status,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      requestedShipAt: orders.requestedShipAt,
      itemDbId: orderItems.id,
      productId: products.id,
      sku: orderItems.sku,
      barcode: products.barcode,
      productName: products.name,
      orderedQuantity: orderItems.orderedQuantity,
      allocatedQuantity: orderItems.allocatedQuantity,
      pickedQuantity: orderItems.pickedQuantity,
      packedQuantity: orderItems.packedQuantity
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orders.id, orderDbId))
    .orderBy(asc(orderItems.id));

  const firstRow = rows[0];

  if (!firstRow) {
    throw new WarehouseDomainError(404, `Order ${orderDbId} was not found.`);
  }

  return {
    dbId: firstRow.dbId,
    warehouseId: firstRow.warehouseId,
    externalReference: firstRow.externalReference,
    sourceChannel: firstRow.sourceChannel,
    status: firstRow.status,
    customerName: firstRow.customerName,
    customerEmail: firstRow.customerEmail,
    requestedShipAt: firstRow.requestedShipAt,
    items: rows.map((row) => ({
      dbId: row.itemDbId,
      productId: row.productId,
      sku: row.sku,
      barcode: row.barcode ?? "",
      productName: row.productName,
      orderedQuantity: row.orderedQuantity,
      allocatedQuantity: row.allocatedQuantity,
      pickedQuantity: row.pickedQuantity,
      packedQuantity: row.packedQuantity
    }))
  };
}

async function loadPickingTasks(executor: DbExecutor): Promise<PickingTask[]> {
  const rows = await executor
    .select({
      dbId: tasks.id,
      code: tasks.code,
      orderDbId: orders.id,
      orderId: orders.externalReference,
      warehouseId: tasks.warehouseId,
      sourceChannel: orders.sourceChannel,
      customerName: orders.customerName,
      productId: products.id,
      sku: products.sku,
      barcode: products.barcode,
      productName: products.name,
      sourceBinId: tasks.sourceBinId,
      sourceBin: bins.code,
      expectedQuantity: tasks.expectedQuantity,
      pickedQuantity: tasks.actualQuantity,
      status: tasks.status,
      assigneeName: users.displayName
    })
    .from(tasks)
    .innerJoin(orders, eq(tasks.orderId, orders.id))
    .innerJoin(products, eq(tasks.productId, products.id))
    .innerJoin(bins, eq(tasks.sourceBinId, bins.id))
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(eq(tasks.type, "picking"))
    .orderBy(asc(tasks.code));

  return pickingQueueResponseSchema.parse({
    tasks: rows.map((row) => {
      if (!row.barcode) {
        throw new WarehouseDomainError(
          500,
          `Picking task ${row.code} is missing barcode metadata for ${row.sku}.`
        );
      }

      if (!row.sourceBinId) {
        throw new WarehouseDomainError(
          500,
          `Picking task ${row.code} is missing a source bin configuration.`
        );
      }

      return toPickingTask({
        dbId: row.dbId,
        code: row.code,
        orderDbId: row.orderDbId,
        orderId: row.orderId,
        warehouseId: row.warehouseId,
        sourceChannel: row.sourceChannel,
        customerName: row.customerName,
        productId: row.productId,
        sku: row.sku,
        barcode: row.barcode,
        productName: row.productName,
        sourceBinId: row.sourceBinId,
        sourceBin: row.sourceBin,
        expectedQuantity: row.expectedQuantity,
        pickedQuantity: row.pickedQuantity ?? 0,
        status: row.status,
        assigneeName: row.assigneeName
      });
    })
  }).tasks;
}

async function loadPickingTasksByCode(executor: DbExecutor, taskCodes: string[]) {
  if (taskCodes.length === 0) {
    return [] satisfies PickingTask[];
  }

  const codeSet = new Set(taskCodes);

  return (await loadPickingTasks(executor)).filter((task) => codeSet.has(task.id));
}

async function loadPickingTaskContext(
  executor: DbExecutor,
  taskCode: string
): Promise<PickingTaskContext> {
  const rows = await executor
    .select({
      dbId: tasks.id,
      code: tasks.code,
      orderDbId: orders.id,
      orderId: orders.externalReference,
      warehouseId: tasks.warehouseId,
      sourceChannel: orders.sourceChannel,
      customerName: orders.customerName,
      productId: products.id,
      sku: products.sku,
      barcode: products.barcode,
      productName: products.name,
      sourceBinId: tasks.sourceBinId,
      sourceBin: bins.code,
      expectedQuantity: tasks.expectedQuantity,
      pickedQuantity: tasks.actualQuantity,
      status: tasks.status,
      assigneeName: users.displayName
    })
    .from(tasks)
    .innerJoin(orders, eq(tasks.orderId, orders.id))
    .innerJoin(products, eq(tasks.productId, products.id))
    .innerJoin(bins, eq(tasks.sourceBinId, bins.id))
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(eq(tasks.type, "picking"), eq(tasks.code, taskCode)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new WarehouseDomainError(404, `Picking task ${taskCode} was not found.`);
  }

  if (!row.barcode) {
    throw new WarehouseDomainError(
      500,
      `Picking task ${row.code} is missing barcode metadata for ${row.sku}.`
    );
  }

  if (!row.sourceBinId) {
    throw new WarehouseDomainError(
      500,
      `Picking task ${row.code} is missing a source bin configuration.`
    );
  }

  return {
    dbId: row.dbId,
    code: row.code,
    orderDbId: row.orderDbId,
    orderId: row.orderId,
    warehouseId: row.warehouseId,
    sourceChannel: row.sourceChannel,
    customerName: row.customerName,
    productId: row.productId,
    sku: row.sku,
    barcode: row.barcode,
    productName: row.productName,
    sourceBinId: row.sourceBinId,
    sourceBin: row.sourceBin,
    expectedQuantity: row.expectedQuantity,
    pickedQuantity: row.pickedQuantity ?? 0,
    status: row.status,
    assigneeName: row.assigneeName
  };
}

async function loadPackingTasks(executor: DbExecutor): Promise<PackingTask[]> {
  const rows = await executor
    .select({
      dbId: tasks.id,
      code: tasks.code,
      orderDbId: orders.id,
      orderId: orders.externalReference,
      warehouseId: tasks.warehouseId,
      sourceChannel: orders.sourceChannel,
      customerName: orders.customerName,
      expectedQuantity: tasks.expectedQuantity,
      packedQuantity: tasks.actualQuantity,
      status: tasks.status,
      assigneeName: users.displayName
    })
    .from(tasks)
    .innerJoin(orders, eq(tasks.orderId, orders.id))
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(eq(tasks.type, "packing"))
    .orderBy(asc(tasks.code));

  return packingQueueResponseSchema.parse({
    tasks: rows.map((row) =>
      toPackingTask({
        dbId: row.dbId,
        code: row.code,
        orderDbId: row.orderDbId,
        orderId: row.orderId,
        warehouseId: row.warehouseId,
        sourceChannel: row.sourceChannel,
        customerName: row.customerName,
        expectedQuantity: row.expectedQuantity,
        packedQuantity: row.packedQuantity ?? 0,
        status: row.status,
        assigneeName: row.assigneeName
      })
    )
  }).tasks;
}

async function loadPackingTaskContext(
  executor: DbExecutor,
  taskCode: string
): Promise<PackingTaskContext> {
  const rows = await executor
    .select({
      dbId: tasks.id,
      code: tasks.code,
      orderDbId: orders.id,
      orderId: orders.externalReference,
      warehouseId: tasks.warehouseId,
      sourceChannel: orders.sourceChannel,
      customerName: orders.customerName,
      expectedQuantity: tasks.expectedQuantity,
      packedQuantity: tasks.actualQuantity,
      status: tasks.status,
      assigneeName: users.displayName
    })
    .from(tasks)
    .innerJoin(orders, eq(tasks.orderId, orders.id))
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(eq(tasks.type, "packing"), eq(tasks.code, taskCode)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new WarehouseDomainError(404, `Packing task ${taskCode} was not found.`);
  }

  return {
    dbId: row.dbId,
    code: row.code,
    orderDbId: row.orderDbId,
    orderId: row.orderId,
    warehouseId: row.warehouseId,
    sourceChannel: row.sourceChannel,
    customerName: row.customerName,
    expectedQuantity: row.expectedQuantity,
    packedQuantity: row.packedQuantity ?? 0,
    status: row.status,
    assigneeName: row.assigneeName
  };
}

async function loadPackingTaskContextByOrderDbId(executor: DbExecutor, orderDbId: string) {
  const rows = await executor
    .select({
      dbId: tasks.id,
      code: tasks.code,
      orderDbId: orders.id,
      orderId: orders.externalReference,
      warehouseId: tasks.warehouseId,
      sourceChannel: orders.sourceChannel,
      customerName: orders.customerName,
      expectedQuantity: tasks.expectedQuantity,
      packedQuantity: tasks.actualQuantity,
      status: tasks.status,
      assigneeName: users.displayName
    })
    .from(tasks)
    .innerJoin(orders, eq(tasks.orderId, orders.id))
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(eq(tasks.type, "packing"), eq(tasks.orderId, orderDbId)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    dbId: row.dbId,
    code: row.code,
    orderDbId: row.orderDbId,
    orderId: row.orderId,
    warehouseId: row.warehouseId,
    sourceChannel: row.sourceChannel,
    customerName: row.customerName,
    expectedQuantity: row.expectedQuantity,
    packedQuantity: row.packedQuantity ?? 0,
    status: row.status,
    assigneeName: row.assigneeName
  } satisfies PackingTaskContext;
}

async function loadShipmentSummaries(executor: DbExecutor): Promise<ShipmentSummary[]> {
  const rows = await executor
    .select({
      dbId: shipments.id,
      orderDbId: orders.id,
      orderId: orders.externalReference,
      sourceChannel: orders.sourceChannel,
      customerName: orders.customerName,
      status: shipments.status,
      carrierCode: shipments.carrierCode,
      serviceLevel: shipments.serviceLevel,
      trackingNumber: shipments.trackingNumber,
      packageCount: shipments.packageCount,
      packedAt: orders.packedAt,
      dispatchedAt: shipments.dispatchedAt
    })
    .from(shipments)
    .innerJoin(orders, eq(shipments.orderId, orders.id))
    .orderBy(asc(orders.externalReference));

  return shipmentOverviewResponseSchema.parse({
    shipments: rows.map((row) =>
      toShipmentSummary({
        dbId: row.dbId,
        orderDbId: row.orderDbId,
        orderId: row.orderId,
        sourceChannel: row.sourceChannel,
        customerName: row.customerName,
        status: row.status,
        carrierCode: row.carrierCode,
        serviceLevel: row.serviceLevel,
        trackingNumber: row.trackingNumber,
        packageCount: row.packageCount,
        packedAt: row.packedAt,
        dispatchedAt: row.dispatchedAt
      })
    )
  }).shipments;
}

async function loadShipmentContext(executor: DbExecutor, shipmentId: string): Promise<ShipmentContext> {
  const rows = await executor
    .select({
      dbId: shipments.id,
      orderDbId: orders.id,
      orderId: orders.externalReference,
      sourceChannel: orders.sourceChannel,
      customerName: orders.customerName,
      status: shipments.status,
      carrierCode: shipments.carrierCode,
      serviceLevel: shipments.serviceLevel,
      trackingNumber: shipments.trackingNumber,
      packageCount: shipments.packageCount,
      packedAt: orders.packedAt,
      dispatchedAt: shipments.dispatchedAt
    })
    .from(shipments)
    .innerJoin(orders, eq(shipments.orderId, orders.id))
    .where(eq(shipments.id, shipmentId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new WarehouseDomainError(404, `Shipment ${shipmentId} was not found.`);
  }

  return {
    dbId: row.dbId,
    orderDbId: row.orderDbId,
    orderId: row.orderId,
    sourceChannel: row.sourceChannel,
    customerName: row.customerName,
    status: row.status,
    carrierCode: row.carrierCode,
    serviceLevel: row.serviceLevel,
    trackingNumber: row.trackingNumber,
    packageCount: row.packageCount,
    packedAt: row.packedAt,
    dispatchedAt: row.dispatchedAt
  };
}

async function loadShipmentContextByOrderDbId(executor: DbExecutor, orderDbId: string) {
  const rows = await executor
    .select({
      dbId: shipments.id,
      orderDbId: orders.id,
      orderId: orders.externalReference,
      sourceChannel: orders.sourceChannel,
      customerName: orders.customerName,
      status: shipments.status,
      carrierCode: shipments.carrierCode,
      serviceLevel: shipments.serviceLevel,
      trackingNumber: shipments.trackingNumber,
      packageCount: shipments.packageCount,
      packedAt: orders.packedAt,
      dispatchedAt: shipments.dispatchedAt
    })
    .from(shipments)
    .innerJoin(orders, eq(shipments.orderId, orders.id))
    .where(eq(shipments.orderId, orderDbId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    dbId: row.dbId,
    orderDbId: row.orderDbId,
    orderId: row.orderId,
    sourceChannel: row.sourceChannel,
    customerName: row.customerName,
    status: row.status,
    carrierCode: row.carrierCode,
    serviceLevel: row.serviceLevel,
    trackingNumber: row.trackingNumber,
    packageCount: row.packageCount,
    packedAt: row.packedAt,
    dispatchedAt: row.dispatchedAt
  } satisfies ShipmentContext;
}

async function loadShipmentSummaryById(executor: DbExecutor, shipmentId: string) {
  return toShipmentSummary(await loadShipmentContext(executor, shipmentId));
}

async function releasePackingTaskIfReady(executor: DbExecutor, orderDbId: string) {
  const order = await loadOrderContextByDbId(executor, orderDbId);

  if (!isOrderReadyForPacking(order)) {
    return null;
  }

  const expectedQuantity = order.items.reduce((sum, item) => sum + item.pickedQuantity, 0);
  const existing = await loadPackingTaskContextByOrderDbId(executor, orderDbId);

  if (existing) {
    if (existing.expectedQuantity !== expectedQuantity) {
      await executor
        .update(tasks)
        .set({
          expectedQuantity,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, existing.dbId));

      return loadPackingTaskContext(executor, existing.code);
    }

    return null;
  }

  const taskCode = buildPackingTaskCode(order.externalReference);

  await executor.insert(tasks).values({
    code: taskCode,
    warehouseId: order.warehouseId,
    type: "packing",
    status: "open",
    orderId: order.dbId,
    productId: null,
    sourceBinId: null,
    destinationBinId: null,
    assigneeId: null,
    expectedQuantity,
    actualQuantity: 0
  });

  return loadPackingTaskContext(executor, taskCode);
}

async function loadOrderLineForPicking(executor: DbExecutor, orderId: string, productId: string) {
  const rows = await executor
    .select({
      dbId: orderItems.id,
      allocatedQuantity: orderItems.allocatedQuantity,
      pickedQuantity: orderItems.pickedQuantity
    })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new WarehouseDomainError(
      404,
      `Order line for product ${productId} was not found on order ${orderId}.`
    );
  }

  return row;
}

async function loadInventoryCandidates(
  executor: DbExecutor,
  warehouseId: string,
  productIds: string[]
): Promise<InventoryAllocationCandidate[]> {
  const uniqueProductIds = [...new Set(productIds)];

  if (uniqueProductIds.length === 0) {
    return [];
  }

  return executor
    .select({
      id: inventory.id,
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      binId: inventory.binId,
      binCode: bins.code,
      onHandQuantity: inventory.onHandQuantity,
      allocatedQuantity: inventory.allocatedQuantity,
      damagedQuantity: inventory.damagedQuantity
    })
    .from(inventory)
    .innerJoin(bins, eq(inventory.binId, bins.id))
    .innerJoin(products, eq(inventory.productId, products.id))
    .where(and(eq(inventory.warehouseId, warehouseId), inArray(inventory.productId, uniqueProductIds)))
    .orderBy(asc(bins.code));
}

async function loadBinCodeMap(executor: DbExecutor, binIds: string[]) {
  const uniqueBinIds = [...new Set(binIds)];

  if (uniqueBinIds.length === 0) {
    return new Map<string, string>();
  }

  const rows = await executor
    .select({
      id: bins.id,
      code: bins.code
    })
    .from(bins)
    .where(inArray(bins.id, uniqueBinIds));

  return new Map(rows.map((row) => [row.id, row.code]));
}

async function loadBinByCode(executor: DbExecutor, binCode: string) {
  const rows = await executor
    .select({
      id: bins.id,
      code: bins.code
    })
    .from(bins)
    .where(eq(bins.code, binCode))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new WarehouseDomainError(404, `Bin ${binCode} was not found.`);
  }

  return row;
}

async function loadInventoryBalance(
  executor: DbExecutor,
  warehouseId: string,
  productId: string,
  binId: string
) {
  const rows = await executor
    .select({
      id: inventory.id,
      onHandQuantity: inventory.onHandQuantity,
      allocatedQuantity: inventory.allocatedQuantity,
      damagedQuantity: inventory.damagedQuantity
    })
    .from(inventory)
    .where(
      and(
        eq(inventory.warehouseId, warehouseId),
        eq(inventory.productId, productId),
        eq(inventory.binId, binId)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

async function loadInventoryRecordContext(
  executor: DbExecutor,
  inventoryId: string
): Promise<InventoryRecordContext> {
  const rows = await executor
    .select({
      id: inventory.id,
      warehouseId: inventory.warehouseId,
      productId: products.id,
      sku: products.sku,
      barcode: products.barcode,
      productName: products.name,
      binId: bins.id,
      binCode: bins.code,
      onHandQuantity: inventory.onHandQuantity,
      allocatedQuantity: inventory.allocatedQuantity,
      damagedQuantity: inventory.damagedQuantity
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(bins, eq(inventory.binId, bins.id))
    .where(eq(inventory.id, inventoryId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new WarehouseDomainError(404, `Inventory record ${inventoryId} was not found.`);
  }

  if (!row.barcode) {
    throw new WarehouseDomainError(
      500,
      `Inventory record ${inventoryId} is missing barcode metadata for ${row.sku}.`
    );
  }

  return {
    ...row,
    barcode: row.barcode
  };
}

async function loadInventoryRecordContextByTarget(
  executor: DbExecutor,
  warehouseId: string,
  productId: string,
  binId: string
): Promise<InventoryRecordContext> {
  const rows = await executor
    .select({
      id: inventory.id,
      warehouseId: inventory.warehouseId,
      productId: products.id,
      sku: products.sku,
      barcode: products.barcode,
      productName: products.name,
      binId: bins.id,
      binCode: bins.code,
      onHandQuantity: inventory.onHandQuantity,
      allocatedQuantity: inventory.allocatedQuantity,
      damagedQuantity: inventory.damagedQuantity
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(bins, eq(inventory.binId, bins.id))
    .where(
      and(
        eq(inventory.warehouseId, warehouseId),
        eq(inventory.productId, productId),
        eq(inventory.binId, binId)
      )
    )
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new WarehouseDomainError(404, `Inventory target ${productId} in ${binId} was not found.`);
  }

  if (!row.barcode) {
    throw new WarehouseDomainError(
      500,
      `Inventory record ${row.id} is missing barcode metadata for ${row.sku}.`
    );
  }

  return {
    ...row,
    barcode: row.barcode
  };
}

async function loadOpenCountTaskForInventoryTarget(
  executor: DbExecutor,
  warehouseId: string,
  productId: string,
  binId: string
) {
  const rows = await executor
    .select({
      code: tasks.code
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.type, "counting"),
        eq(tasks.warehouseId, warehouseId),
        eq(tasks.productId, productId),
        eq(tasks.sourceBinId, binId),
        or(eq(tasks.status, "open"), eq(tasks.status, "in_progress"), eq(tasks.status, "blocked"))
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

async function queryCountTaskSequence(executor: DbExecutor, productId: string, binId: string) {
  const rows = await executor
    .select({
      count: sql<number>`cast(count(*) as integer)`
    })
    .from(tasks)
    .where(and(eq(tasks.type, "counting"), eq(tasks.productId, productId), eq(tasks.sourceBinId, binId)));

  return (rows[0]?.count ?? 0) + 1;
}

async function upsertInventoryBalance(
  executor: DbExecutor,
  input: {
    warehouseId: string;
    productId: string;
    binId: string;
    quantityDelta: number;
  }
): Promise<PersistedInventoryRecord> {
  const existing = await loadInventoryBalance(
    executor,
    input.warehouseId,
    input.productId,
    input.binId
  );

  if (existing) {
    const nextOnHandQuantity = existing.onHandQuantity + input.quantityDelta;

    await executor
      .update(inventory)
      .set({
        onHandQuantity: nextOnHandQuantity,
        updatedAt: new Date()
      })
      .where(eq(inventory.id, existing.id));

    return {
      ...existing,
      onHandQuantity: nextOnHandQuantity
    };
  }

  const inserted = await executor
    .insert(inventory)
    .values({
      warehouseId: input.warehouseId,
      productId: input.productId,
      binId: input.binId,
      onHandQuantity: input.quantityDelta,
      allocatedQuantity: 0,
      damagedQuantity: 0
    })
    .returning({
      id: inventory.id,
      onHandQuantity: inventory.onHandQuantity,
      allocatedQuantity: inventory.allocatedQuantity,
      damagedQuantity: inventory.damagedQuantity
    });

  const record = inserted[0];

  if (!record) {
    throw new WarehouseDomainError(500, "Failed to create inventory balance.");
  }

  return record;
}

async function upsertInventoryDamageBalance(
  executor: DbExecutor,
  input: {
    warehouseId: string;
    productId: string;
    binId: string;
    quantityDelta: number;
  }
): Promise<PersistedInventoryRecord> {
  const existing = await loadInventoryBalance(
    executor,
    input.warehouseId,
    input.productId,
    input.binId
  );

  if (existing) {
    const nextDamagedQuantity = existing.damagedQuantity + input.quantityDelta;

    await executor
      .update(inventory)
      .set({
        damagedQuantity: nextDamagedQuantity,
        updatedAt: new Date()
      })
      .where(eq(inventory.id, existing.id));

    return {
      ...existing,
      damagedQuantity: nextDamagedQuantity
    };
  }

  const inserted = await executor
    .insert(inventory)
    .values({
      warehouseId: input.warehouseId,
      productId: input.productId,
      binId: input.binId,
      onHandQuantity: 0,
      allocatedQuantity: 0,
      damagedQuantity: input.quantityDelta
    })
    .returning({
      id: inventory.id,
      onHandQuantity: inventory.onHandQuantity,
      allocatedQuantity: inventory.allocatedQuantity,
      damagedQuantity: inventory.damagedQuantity
    });

  const record = inserted[0];

  if (!record) {
    throw new WarehouseDomainError(500, "Failed to create return inventory balance.");
  }

  return record;
}

function toReceivingTask(task: ReceivingTaskContext): ReceivingTask {
  return {
    id: task.code,
    productId: task.productId,
    sku: task.sku,
    barcode: task.barcode,
    productName: task.productName,
    expectedQuantity: task.expectedQuantity,
    receivedQuantity: task.receivedQuantity,
    stagingBin: task.stagingBin,
    destinationBin: task.destinationBin,
    status: task.status
  };
}

function toOrderSummary(order: OrderContext): OrderSummary {
  const items = order.items.map((item) => ({
    productId: item.productId,
    sku: item.sku,
    productName: item.productName,
    orderedQuantity: item.orderedQuantity,
    allocatedQuantity: item.allocatedQuantity,
    pickedQuantity: item.pickedQuantity,
    packedQuantity: item.packedQuantity
  }));

  return {
    id: order.externalReference,
    sourceChannel: order.sourceChannel,
    status: order.status,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    requestedShipAt: order.requestedShipAt?.toISOString() ?? null,
    lineCount: items.length,
    unitsOrdered: items.reduce((sum, item) => sum + item.orderedQuantity, 0),
    unitsAllocated: items.reduce((sum, item) => sum + item.allocatedQuantity, 0),
    unitsPicked: items.reduce((sum, item) => sum + item.pickedQuantity, 0),
    unitsPacked: items.reduce((sum, item) => sum + item.packedQuantity, 0),
    hasException: order.status === "exception",
    items
  };
}

function toPickingTask(task: PickingTaskContext): PickingTask {
  return {
    id: task.code,
    orderId: task.orderId,
    sourceChannel: task.sourceChannel,
    customerName: task.customerName,
    productId: task.productId,
    sku: task.sku,
    barcode: task.barcode,
    productName: task.productName,
    sourceBin: task.sourceBin,
    expectedQuantity: task.expectedQuantity,
    pickedQuantity: task.pickedQuantity,
    status: task.status,
    assigneeName: task.assigneeName
  };
}

function toPackingTask(task: PackingTaskContext): PackingTask {
  return {
    id: task.code,
    orderId: task.orderId,
    sourceChannel: task.sourceChannel,
    customerName: task.customerName,
    expectedQuantity: task.expectedQuantity,
    packedQuantity: task.packedQuantity,
    status: task.status,
    assigneeName: task.assigneeName
  };
}

function toCountTask(task: CountTaskContext): CountTask {
  return {
    id: task.code,
    productId: task.productId,
    sku: task.sku,
    barcode: task.barcode,
    productName: task.productName,
    binCode: task.binCode,
    expectedQuantity: task.expectedQuantity,
    countedQuantity: task.countedQuantity,
    varianceQuantity:
      task.countedQuantity === null ? null : task.countedQuantity - task.expectedQuantity,
    status: task.status,
    assigneeName: task.assigneeName
  };
}

function toShipmentSummary(shipment: ShipmentContext): ShipmentSummary {
  return {
    id: shipment.dbId,
    orderId: shipment.orderId,
    sourceChannel: shipment.sourceChannel,
    customerName: shipment.customerName,
    status: shipment.status,
    carrierCode: shipment.carrierCode,
    serviceLevel: shipment.serviceLevel,
    trackingNumber: shipment.trackingNumber,
    packageCount: shipment.packageCount,
    packedAt: shipment.packedAt?.toISOString() ?? null,
    dispatchedAt: shipment.dispatchedAt?.toISOString() ?? null
  };
}

function toReturnSummary(returnRequest: ReturnContext): ReturnSummary {
  return {
    id: returnRequest.dbId,
    orderId: returnRequest.orderId,
    sourceChannel: returnRequest.sourceChannel,
    customerName: returnRequest.customerName,
    productId: returnRequest.productId,
    sku: returnRequest.sku,
    barcode: returnRequest.barcode,
    productName: returnRequest.productName,
    quantity: returnRequest.quantity,
    status: returnRequest.status,
    disposition: returnRequest.disposition,
    sourceReference: returnRequest.sourceReference,
    destinationBin: returnRequest.destinationBin,
    receivedAt: returnRequest.receivedAt?.toISOString() ?? null
  };
}

function toInventoryRecord(
  record: PersistedInventoryRecord,
  binCode: string,
  productId: string,
  sku: string,
  productName: string
) {
  return {
    id: record.id,
    productId,
    sku,
    productName,
    binCode,
    onHandQuantity: record.onHandQuantity,
    allocatedQuantity: record.allocatedQuantity,
    damagedQuantity: record.damagedQuantity
  };
}

function toReturnContext(row: {
  dbId: string;
  orderDbId: string;
  orderId: string;
  warehouseId: string;
  sourceChannel: string;
  customerName: string;
  status: "initiated" | "received" | "restocked" | "disposed";
  disposition: string | null;
  sourceReference: string | null;
  receivedAt: Date | null;
  metadata: Record<string, unknown>;
}): ReturnContext {
  const metadata = parseReturnMetadata(row.metadata, row.dbId);

  return {
    dbId: row.dbId,
    orderDbId: row.orderDbId,
    orderId: row.orderId,
    warehouseId: row.warehouseId,
    sourceChannel: row.sourceChannel,
    customerName: row.customerName,
    productId: metadata.productId,
    sku: metadata.sku,
    barcode: metadata.barcode,
    productName: metadata.productName,
    quantity: metadata.quantity,
    status: row.status,
    disposition: parseReturnDisposition(row.disposition),
    sourceReference: row.sourceReference,
    destinationBin: metadata.destinationBin,
    receivedAt: row.receivedAt
  };
}

function availableQuantity(record: InventoryAllocationCandidate) {
  return Math.max(record.onHandQuantity - record.allocatedQuantity - record.damagedQuantity, 0);
}

function buildPickingTaskCode(orderReference: string, taskIndex: number) {
  return `PICK-${orderReference.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase()}-${String(taskIndex).padStart(2, "0")}`;
}

function buildPackingTaskCode(orderReference: string) {
  return `PACK-${orderReference.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase()}`;
}

function buildCountTaskCode(sku: string, binCode: string, countIndex: number) {
  return `COUNT-${sanitizeCodePart(sku)}-${sanitizeCodePart(binCode)}-${String(countIndex).padStart(2, "0")}`;
}

function isOrderReadyForPacking(order: OrderContext) {
  return order.items.every((item) => item.pickedQuantity >= item.orderedQuantity);
}

function isString(value: string | null): value is string {
  return typeof value === "string";
}

function parseReturnMetadata(metadata: Record<string, unknown>, returnId: string) {
  const productId = typeof metadata.productId === "string" ? metadata.productId : null;
  const sku = typeof metadata.sku === "string" ? metadata.sku : null;
  const barcode = typeof metadata.barcode === "string" ? metadata.barcode : null;
  const productName = typeof metadata.productName === "string" ? metadata.productName : null;
  const destinationBin = typeof metadata.destinationBin === "string" ? metadata.destinationBin : null;
  const quantity =
    typeof metadata.quantity === "number"
      ? metadata.quantity
      : typeof metadata.quantity === "string"
        ? Number(metadata.quantity)
        : Number.NaN;

  if (!productId || !sku || !barcode || !productName || !Number.isInteger(quantity) || quantity <= 0) {
    throw new WarehouseDomainError(500, `Return ${returnId} is missing required metadata.`);
  }

  return {
    productId,
    sku,
    barcode,
    productName,
    quantity,
    destinationBin
  };
}

function parseReturnDisposition(value: string | null): ReturnDisposition | null {
  if (value === "restock" || value === "quarantine" || value === "damage") {
    return value;
  }

  return null;
}

function sanitizeCodePart(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase();
}
