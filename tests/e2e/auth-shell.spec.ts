import { expect, test } from "@playwright/test";

test("renders the sign-in shell with local role sessions", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page.getByRole("heading", { name: /warehouse session sign-in/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in as manager/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in as receiver/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
});
