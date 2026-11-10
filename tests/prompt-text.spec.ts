import { test, expect } from "@playwright/test";

test("text is opt-in and independent labels/counters persist without leaking when switched off", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("text-test-initialized")) {
      localStorage.removeItem("framescript.prompt-draft.v1");
      localStorage.setItem("text-test-initialized", "yes");
    }
  });
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  const panel = page.locator(".prompt-drawer");
  await panel.getByRole("tab", { name: "Typography", exact: true }).click();
  const toggle = panel.getByLabel("Include typography in prompt", {
    exact: true,
  });
  await expect(toggle).not.toBeChecked();
  const generated = panel.locator('textarea[aria-label="Generated prompt"]');
  expect(await generated.inputValue()).not.toContain("TYPOGRAPHY & SUBTITLES");
  await toggle.check();
  await panel
    .getByRole("button", { name: "Add text item", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Copy and Download", exact: true }),
  ).toBeDisabled();
  await panel.getByLabel("Exact item text", { exact: true }).fill("Red planet");
  await panel
    .getByLabel("Subject / object to follow (optional except subject labels)", {
      exact: true,
    })
    .fill("Mars orbiting the sun");
  await panel.getByLabel("Item font family", { exact: true }).fill("Georgia");
  await panel.getByLabel("Item font size (px)", { exact: true }).fill("48");
  await panel.getByLabel("Item X (%)", { exact: true }).fill("70");
  await panel
    .getByLabel("Text item type", { exact: true })
    .selectOption("Number counter");
  await panel
    .getByRole("button", { name: "Add text item", exact: true })
    .click();
  await panel.getByLabel("Counter to", { exact: true }).fill("1250");
  await panel.getByLabel("Counter decimal places", { exact: true }).fill("2");
  await panel.getByLabel("Counter prefix", { exact: true }).fill("$");
  await panel.getByLabel("Counter suffix", { exact: true }).fill(" million");
  await panel.getByLabel("Item end (seconds)", { exact: true }).fill("8");
  await expect(
    panel.getByRole("button", { name: "Copy and Download", exact: true }),
  ).toBeEnabled();
  let prompt = await generated.inputValue();
  for (const value of [
    "Red planet",
    "Mars orbiting the sun",
    "Georgia",
    '"to": 1250',
    '"decimals": 2',
    " million",
  ])
    expect(prompt).toContain(value);
  await page.screenshot({ path: "test-results/prompt-text-items.png" });
  await panel.getByLabel("Item end (seconds)", { exact: true }).fill("0");
  await expect(
    panel.getByRole("button", { name: "Copy and Download", exact: true }),
  ).toBeDisabled();
  await panel.getByLabel("Item end (seconds)", { exact: true }).fill("8");
  await toggle.uncheck();
  prompt = await generated.inputValue();
  for (const value of [
    "Red planet",
    "Georgia",
    "TYPOGRAPHY & SUBTITLES",
    '"to": 1250',
  ])
    expect(prompt).not.toContain(value);
  await page.reload();
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  await panel.getByRole("tab", { name: "Typography", exact: true }).click();
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  expect(await generated.inputValue()).toContain('"to": 1250');
  await panel
    .getByLabel("Enable selected text item", { exact: true })
    .uncheck();
  expect(await generated.inputValue()).not.toContain("Red planet");
  expect(await generated.inputValue()).toContain('"to": 1250');
});
