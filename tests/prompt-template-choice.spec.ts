import { test, expect } from "@playwright/test";

test("expanded templates have delayed hover examples, keyboard details and working prompt direction", async ({
  page,
}) => {
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  const panel = page.locator(".prompt-drawer");
  await panel.getByRole("tab", { name: "Brief", exact: true }).click();
  const templates = panel.getByRole("group", {
    name: "Animation templates",
    exact: true,
  });
  await expect(templates.getByRole("button")).toHaveCount(14);
  const data = templates.getByRole("button", {
    name: "Use Data visualization template",
    exact: true,
  });
  await page.clock.install();
  await data.hover();
  await page.clock.runFor(300);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.clock.runFor(250);
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("Animate bars from 20 to 45 to 80");
  await page.screenshot({ path: "test-results/template-hover-example.png" });
  await data.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await data.click();
  await expect(data).toHaveAttribute("aria-pressed", "true");
  expect(
    await panel.locator('textarea[aria-label="Generated prompt"]').inputValue(),
  ).toContain("Animate accurate charts and comparisons");
  const process = templates.getByRole("button", {
    name: "Use Process / flow diagram template",
    exact: true,
  });
  await process.focus();
  await page.clock.runFor(550);
  await expect(tooltip).toContainText("filtration, storage and delivery");
  await page.keyboard.press("Tab");
  await expect(tooltip).toHaveCount(0);
  await panel.getByRole("tab", { name: "Output", exact: true }).click();
  await page.clock.runFor(600);
  await expect(tooltip).toHaveCount(0);
});
