import { test, expect } from "@playwright/test";

test("old narrow widths are raised to the minimum while smaller screens still fit", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("framescript.prompt-width.v1", "360"),
  );
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  const handle = page.getByRole("separator", {
    name: "Resize prompt builder",
    exact: true,
  });
  await expect(handle).toHaveAttribute("aria-valuenow", "560");
  await handle.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", "560");
  await page.setViewportSize({ width: 390, height: 850 });
  await expect(handle).toHaveAttribute("aria-valuenow", "378");
  await expect(handle).toHaveAttribute("aria-valuemin", "378");
  expect(
    await page
      .locator(".prompt-drawer")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect(handle).toHaveAttribute("aria-valuenow", "560");
});

test("prompt drawer slides, resizes from its left edge and restores width within viewport bounds", async ({
  page,
}) => {
  await page.goto("/#editor");
  const toggle = page.getByRole("button", {
    name: "Prompts panel",
    exact: true,
  });
  await toggle.click();
  const panel = page.locator(".prompt-drawer");
  const handle = page.getByRole("separator", {
    name: "Resize prompt builder",
    exact: true,
  });
  await expect(panel).toHaveCSS("animation-name", "prompt-drawer-enter");
  await expect
    .poll(() =>
      panel.evaluate((el) =>
        el
          .getAnimations()
          .every((animation) => animation.playState === "finished"),
      ),
    )
    .toBe(true);
  await expect(handle).toHaveAttribute("aria-valuenow", "820");
  const bounds = (await handle.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 100);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 - 160, bounds.y + 100, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(handle).toHaveAttribute("aria-valuenow", "980");
  await handle.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", "960");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("framescript.prompt-width.v1")),
    )
    .toBe("960");
  await panel.getByRole("button", { name: "Collapse prompt drawer" }).click();
  await expect(panel).toHaveAttribute("data-state", "closing");
  await expect(panel).toHaveCount(0);
  await toggle.click();
  await expect(handle).toHaveAttribute("aria-valuenow", "960");
  await page.reload();
  await toggle.click();
  await expect(handle).toHaveAttribute("aria-valuenow", "960");
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(handle).toHaveAttribute("aria-valuenow", "756");
  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect(handle).toHaveAttribute("aria-valuenow", "960");
  await handle.press("Home");
  await expect(handle).toHaveAttribute("aria-valuenow", "560");
  await handle.dblclick();
  await expect(handle).toHaveAttribute("aria-valuenow", "820");
});

test("drawer content adapts to narrow, medium and full desktop widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  const panel = page.locator(".prompt-drawer");
  await panel.getByRole("tab", { name: "Reference look", exact: true }).click();
  const handle = page.getByRole("separator", {
    name: "Resize prompt builder",
    exact: true,
  });
  const columns = () =>
    panel
      .getByRole("radiogroup")
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
  await expect.poll(columns).toBe(2);
  await handle.press("End");
  await expect(handle).toHaveAttribute("aria-valuenow", "1908");
  const grip = (await handle.locator("span").boundingBox())!;
  const arrow = (await panel
    .getByRole("button", { name: "Collapse prompt drawer" })
    .boundingBox())!;
  expect(
    Math.abs(grip.y + grip.height / 2 - (arrow.y + arrow.height / 2)),
  ).toBeLessThan(1);
  await expect.poll(columns).toBe(4);
  const footer = await panel.locator(".prompt-actions").boundingBox();
  const copy = await panel
    .getByRole("button", { name: "Copy and Download", exact: true })
    .boundingBox();
  expect(footer!.height).toBeLessThanOrEqual(56);
  expect(copy!.width).toBeLessThan(200);
  await expect
    .poll(() =>
      panel
        .getByRole("tablist")
        .evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        ),
    )
    .toBe(10);
  const content = panel.getByRole("tabpanel");
  expect((await content.boundingBox())!.width).toBeLessThanOrEqual(1440);
  expect(
    await panel
      .getByRole("radiogroup")
      .locator("strong")
      .first()
      .evaluate((el) => getComputedStyle(el).fontSize),
  ).toBe("14px");
  await page.screenshot({ path: "test-results/prompt-drawer-wide.png" });
  await handle.press("Home");
  await expect.poll(columns).toBe(2);
  await expect(
    panel.getByRole("button", { name: "Copy and Download", exact: true }),
  ).toBeInViewport();
  await expect(
    panel.locator(".prompt-actions button"),
  ).toHaveCount(1);
  expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/prompt-drawer-narrow.png" });
});
