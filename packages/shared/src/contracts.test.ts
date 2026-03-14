import { describe, expect, it } from "vitest";

import {
  inventoryRecordSchema,
  orderStatusSchema,
  receivingTaskSchema,
  workflowCards
} from "./contracts.js";

describe("shared contracts", () => {
  it("accepts only supported order states", () => {
    expect(orderStatusSchema.parse("allocated")).toBe("allocated");
  });

  it("validates receiving tasks", () => {
    expect(
      receivingTaskSchema.parse({
        id: "REC-1010",
        productId: "prod-100",
        sku: "SKU-100",
        barcode: "8901000000103",
        productName: "Sample",
        expectedQuantity: 8,
        receivedQuantity: 0,
        stagingBin: "STAGE-A3",
        destinationBin: "B-02-05",
        status: "open"
      }).sku
    ).toBe("SKU-100");
  });

  it("tracks non-negative inventory balances", () => {
    expect(
      inventoryRecordSchema.parse({
        id: "inv-1",
        productId: "prod-100",
        sku: "SKU-100",
        productName: "Sample",
        binCode: "B-02-05",
        onHandQuantity: 10,
        allocatedQuantity: 2,
        damagedQuantity: 0
      }).binCode
    ).toBe("B-02-05");
  });

  it("keeps workflow cards routeable", () => {
    expect(workflowCards.every((card) => card.href.startsWith("/"))).toBe(true);
  });
});
