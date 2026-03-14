import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import {
  auditLogs,
  bins,
  getDb,
  inventory,
  inventoryMovements,
  products,
  tasks
} from "@wms/db";
import {
  inventoryOverviewResponseSchema,
  productCatalogResponseSchema,
  putawayInputSchema,
  receiveStockInputSchema,
  receivingActionResponseSchema,
  receivingQueueResponseSchema,
  type DashboardMetric,
  type ReceivingTask,
  type TaskStatus
} from "@wms/shared";

import type { AuthenticatedActor } from "../auth.js";
import { type WarehouseState, WarehouseDomainError } from "./warehouse-state.js";

type DbClient = ReturnType<typeof getDb>;
type DbTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type DbExecutor = DbClient | DbTransaction;

type TaskContext = {
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

type PersistedInventoryRecord = {
  id: string;
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

    async listReceivingTasks() {
      return loadReceivingTasks(db);
    },

    async getDashboardMetrics() {
      const [records, receivingTasks, exceptionCount] = await Promise.all([
        this.listInventory(),
        this.listReceivingTasks(),
        queryExceptionCount(db)
      ]);

      const totalAllocated = records.reduce((sum, record) => sum + record.allocatedQuantity, 0);
      const totalAvailable = records.reduce(
        (sum, record) =>
          sum + (record.onHandQuantity - record.allocatedQuantity - record.damagedQuantity),
        0
      );
      const totalReceived = receivingTasks.reduce((sum, task) => sum + task.receivedQuantity, 0);
      const openTasks = receivingTasks.filter((task) => task.status !== "completed").length;

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
          change: `${records.length} bin balances live`,
          emphasis: "positive"
        },
        {
          id: "receiving",
          label: "Received this shift",
          value: `${totalReceived} units`,
          change: `${receivingTasks.filter((task) => task.status === "in_progress").length} tasks staged`,
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
      ] satisfies DashboardMetric[];
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

async function loadReceivingTaskContext(executor: DbExecutor, taskCode: string): Promise<TaskContext> {
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

function toReceivingTask(task: TaskContext): ReceivingTask {
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

function isString(value: string | null): value is string {
  return typeof value === "string";
}
