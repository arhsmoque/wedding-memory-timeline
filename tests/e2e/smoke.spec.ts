import { expect, test } from "@playwright/test";

test("guestbook shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Wedding Guestbook")).toBeVisible();
});
