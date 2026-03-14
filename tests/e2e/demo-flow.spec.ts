import { expect, test } from "@playwright/test";

import { signInAsRole } from "./helpers/auth";

test("runs the full warehouse demo flow from receiving through returns", async ({ page }) => {
  test.setTimeout(120_000);

  await signInAsRole(page, "manager", "/receiving");

  const receivingCard = page.locator(".task-card").filter({ hasText: "REC-1008" }).first();
  await expect(receivingCard).toBeVisible();
  await receivingCard.getByLabel("Barcode").fill("8901000000011");
  await receivingCard.getByLabel("Quantity").fill("24");
  await receivingCard.getByRole("button", { name: /confirm receipt/i }).click();
  await expect(page.getByText(/REC-1008: Receipt confirmation recorded/i)).toBeVisible();

  const putAwayCard = page.locator(".task-card").filter({ hasText: "REC-1008" }).first();
  await putAwayCard.getByLabel("Destination bin").fill("B-01-02");
  await putAwayCard.getByRole("button", { name: /complete put-away/i }).click();
  await expect(page.getByText(/REC-1008: Put-away completed/i)).toBeVisible();

  await page.goto("/inventory");

  const chairInventoryCard = page
    .locator(".inventory-card")
    .filter({ hasText: "Axis Ergonomic Chair" })
    .filter({ hasText: "B-01-02" })
    .first();
  await expect(chairInventoryCard).toBeVisible();
  await expect(chairInventoryCard).toContainText("62 available");
  await expect(chairInventoryCard).toContainText("72");

  await page.goto("/orders");

  const orderCard = page.locator(".task-card").filter({ hasText: "SHOP-1101" }).first();
  await expect(orderCard).toBeVisible();
  await orderCard.getByRole("button", { name: /allocate and release picks/i }).click();
  await expect(page.getByText(/SHOP-1101: Allocation completed/i)).toBeVisible();

  const chairPickCard = page.locator(".task-card").filter({ hasText: "PICK-SHOP-1101-01" }).first();
  await expect(chairPickCard).toBeVisible();
  await chairPickCard.getByLabel("Source bin").fill("B-01-02");
  await chairPickCard.getByLabel("Quantity").fill("2");
  await chairPickCard.getByLabel("Barcode").fill("8901000000011");
  await chairPickCard.getByRole("button", { name: /confirm pick/i }).click();
  await expect(page.getByText(/PICK-SHOP-1101-01: Pick confirmation recorded/i)).toBeVisible();

  const lampPickCard = page.locator(".task-card").filter({ hasText: "PICK-SHOP-1101-02" }).first();
  await expect(lampPickCard).toBeVisible();
  await lampPickCard.getByLabel("Source bin").fill("B-04-01");
  await lampPickCard.getByLabel("Quantity").fill("1");
  await lampPickCard.getByLabel("Barcode").fill("8901000000035");
  await lampPickCard.getByRole("button", { name: /confirm pick/i }).click();
  await expect(page.getByText(/PICK-SHOP-1101-02: Pick confirmation recorded/i)).toBeVisible();

  const packCard = page.locator(".task-card").filter({ hasText: "PACK-SHOP-1101" }).first();
  await expect(packCard).toBeVisible();
  await packCard.getByLabel("Package count").fill("1");
  await packCard.getByRole("button", { name: /confirm packing/i }).click();
  await expect(page.getByText(/PACK-SHOP-1101: Packing completed/i)).toBeVisible();

  const shipmentLane = page.locator(".lane-panel").filter({
    has: page.getByRole("heading", { name: /shipment queue/i })
  });
  const shipmentCard = shipmentLane.locator(".task-card").filter({ hasText: "SHOP-1101" }).first();
  await expect(shipmentCard).toBeVisible();
  await shipmentCard.getByLabel("Carrier").fill("delhivery");
  await shipmentCard.getByLabel("Service level").fill("surface");
  await shipmentCard.getByLabel("Tracking number").fill("TRK-SHOP1101");
  await shipmentCard.getByRole("button", { name: /confirm dispatch/i }).click();
  await expect(page.getByText(/SHOP-1101: Shipment dispatch recorded/i)).toBeVisible();

  const shippedOrderCard = page.locator(".task-card").filter({ hasText: "SHOP-1101" }).first();
  await expect(shippedOrderCard.getByText(/^shipped$/i)).toBeVisible();

  await page.goto("/returns");

  const eligibleReturnCard = page
    .locator(".task-card")
    .filter({ hasText: "SHOP-1101" })
    .filter({ hasText: "SKU-LAMP-003" })
    .first();
  await expect(eligibleReturnCard).toBeVisible();
  await eligibleReturnCard.locator('input[name="quantity"]').fill("1");
  await eligibleReturnCard.getByRole("button", { name: /create return/i }).click();
  await expect(page.getByText(/RET-SHOP-1101-01: Return request captured/i)).toBeVisible();

  const pendingReturnCard = page.locator(".task-card").filter({ hasText: "RET-SHOP-1101-01" }).first();
  await expect(pendingReturnCard).toBeVisible();
  await pendingReturnCard.getByLabel("Barcode").fill("8901000000035");
  await pendingReturnCard.getByLabel("Destination bin").fill("B-04-01");
  await pendingReturnCard.getByLabel("Disposition").selectOption("restock");
  await pendingReturnCard.getByRole("button", { name: /confirm return/i }).click();
  await expect(page.getByText(/RET-SHOP-1101-01: Return disposition recorded/i)).toBeVisible();

  const completedReturnCard = page.locator(".task-card").filter({ hasText: "RET-SHOP-1101-01" }).first();
  await expect(completedReturnCard.getByText(/^restocked$/i)).toBeVisible();

  await page.goto("/inventory");

  const lampInventoryCard = page
    .locator(".inventory-card")
    .filter({ hasText: "Halo Task Lamp" })
    .filter({ hasText: "B-04-01" })
    .first();
  await expect(lampInventoryCard).toBeVisible();
  await expect(lampInventoryCard).toContainText("64");

  await page.goto("/counts");

  const releaseLane = page.locator(".lane-panel").filter({
    has: page.getByRole("heading", { name: /inventory ready for count/i })
  });
  const releaseCard = releaseLane
    .locator(".task-card")
    .filter({ hasText: "Halo Task Lamp" })
    .filter({ hasText: "B-04-01" })
    .first();
  await expect(releaseCard).toBeVisible();
  await releaseCard.getByRole("button", { name: /release cycle count/i }).click();
  await expect(page.getByText(/COUNT-SKU-LAMP-003-B-04-01-01: Cycle count task released/i)).toBeVisible();

  const queueLane = page.locator(".lane-panel").filter({
    has: page.getByRole("heading", { name: /open count tasks/i })
  });
  const countCard = queueLane
    .locator(".task-card")
    .filter({ hasText: "COUNT-SKU-LAMP-003-B-04-01-01" })
    .first();
  await expect(countCard).toBeVisible();
  await countCard.locator('input[name="binCode"]').fill("B-04-01");
  await countCard.locator('input[name="barcode"]').fill("8901000000035");
  await countCard.locator('input[name="countedQuantity"]').fill("63");
  await countCard.getByRole("button", { name: /confirm count/i }).click();
  await expect(page.getByText(/COUNT-SKU-LAMP-003-B-04-01-01: Cycle count confirmed/i)).toBeVisible();

  await page.goto("/inventory");
  await expect(lampInventoryCard).toContainText("63");
});
