import { expect, test } from "@playwright/test";

test("renders the overview shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /warehouse control tuned/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Receiving" })).toBeVisible();
});
