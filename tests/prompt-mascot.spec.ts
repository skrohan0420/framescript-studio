import { test, expect } from "@playwright/test";
test("optional mascot section saves direction, uses LLM attachments and excludes disabled choices", async ({
  page,
}) => {
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  const panel = page.locator(".prompt-drawer");
  await panel.getByRole("tab", { name: "Mascot", exact: true }).click();
  const toggle = panel.getByLabel("Include mascot in prompt", { exact: true });
  await expect(toggle).not.toBeChecked();
  const prompt = panel.locator('textarea[aria-label="Generated prompt"]');
  expect(await prompt.inputValue()).not.toContain(
    "MASCOT — EXPLICITLY REQUESTED",
  );
  await toggle.check();
  await panel
    .getByLabel("Mascot name (optional)", { exact: true })
    .fill("Orbit");
  await panel
    .getByLabel("Mascot actions & expressions", { exact: true })
    .fill("Point to Mars");
  await panel
    .getByLabel("Mascot appearance timing", { exact: true })
    .fill("Enter at 2s, leave at 8s");
  expect(await prompt.inputValue()).toContain("Point to Mars");
  expect(await prompt.inputValue()).toContain(
    "include them in the attached ZIP",
  );
  await expect(panel.getByRole("tabpanel").locator('input[type="file"]')).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  await expect(
    panel.getByRole("tab", { name: "Mascot", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(toggle).toBeChecked();
  await expect(
    panel.getByLabel("Mascot name (optional)", { exact: true }),
  ).toHaveValue("Orbit");
  await toggle.uncheck();
  for (const value of [
    "MASCOT — EXPLICITLY REQUESTED",
    "Point to Mars",
    "Orbit",
  ])
    expect(await prompt.inputValue()).not.toContain(value);
  await toggle.check();
  await expect(
    panel.getByLabel("Mascot actions & expressions", { exact: true }),
  ).toHaveValue("Point to Mars");
});
