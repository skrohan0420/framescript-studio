import { test, expect } from "@playwright/test";

test("unfiltered reference and pacing cards retain content height inside scrolling lists", async ({
  page,
}) => {
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  const panel = page.locator(".prompt-drawer");
  await expect
    .poll(() =>
      panel.evaluate((el) =>
        el
          .getAnimations()
          .every((animation) => animation.playState === "finished"),
      ),
    )
    .toBe(true);
  for (const width of [1600, 1280, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        panel.evaluate((element) => element.getBoundingClientRect().width),
      )
      .toBe(width >= 1280 ? 820 : width - 12);
    const drawer = await panel.boundingBox();
    expect(drawer!.width).toBe(width >= 1280 ? 820 : width - 12);
    expect(drawer!.x).toBeGreaterThanOrEqual(0);
    expect(drawer!.x + drawer!.width).toBeLessThanOrEqual(width);
    for (const name of ["Reference look", "Editing & pacing"]) {
      await panel.getByRole("tab", { name, exact: true }).click();
      const list = panel.getByRole("radiogroup");
      await expect(list.getByRole("radio")).toHaveCount(
        name === "Reference look" ? 29 : 17,
      );
      expect(await list.textContent()).not.toContain("undefined");
      const geometry = await list.evaluate((element) => {
        const cards = Array.from(element.children) as HTMLElement[];
        return {
          scrolls: element.scrollHeight > element.clientHeight,
          cards: cards.map((card, index) => {
            const bounds = card.getBoundingClientRect();
            const next = cards[index + 1]?.getBoundingClientRect();
            const content = Array.from(card.children).map((child) =>
              child.getBoundingClientRect(),
            );
            return {
              height: bounds.height,
              contains: content.every(
                (child) =>
                  child.top >= bounds.top && child.bottom <= bounds.bottom,
              ),
              separate:
                !next ||
                next.left >= bounds.right + 6 ||
                next.top >= bounds.bottom + 6,
            };
          }),
        };
      });
      expect(geometry.scrolls).toBe(true);
      for (const card of geometry.cards) {
        expect(card.height).toBeGreaterThan(50);
        expect(card.contains).toBe(true);
        expect(card.separate).toBe(true);
      }
      await list.getByRole("radio").last().scrollIntoViewIfNeeded();
      await expect(list.getByRole("radio").last()).toBeInViewport();
      if (width === 1280)
        await page.screenshot({
          path: `test-results/prompt-cards-fixed-${name.startsWith("Reference") ? "reference" : "pacing"}.png`,
        });
    }
  }
});

test("category filtering and compact cards preserve selection and show complete details", async ({
  page,
}) => {
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  const panel = page.locator(".prompt-drawer");
  await panel.getByRole("tab", { name: "Reference look", exact: true }).click();
  const categories = panel.getByRole("group", {
    name: "Reference look categories",
    exact: true,
  });
  await categories.getByRole("button", { name: /^Science & learning/ }).click();
  await expect(panel.getByRole("radiogroup").getByRole("radio")).toHaveCount(
    10,
  );
  await panel
    .getByLabel("Search reference looks", { exact: true })
    .fill("Microscopic");
  const item = panel.getByRole("radio", { name: /^Microscopic science/ });
  await item.click();
  await expect(item).toHaveAttribute("aria-checked", "true");
  await expect(
    panel.getByRole("tabpanel").locator(".direction-current"),
  ).toContainText("translucent cells");
  await expect(
    panel.getByRole("tabpanel").locator(".direction-current"),
  ).toContainText("A translucent cell opens");
  await panel
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(panel.getByRole("radiogroup").getByRole("radio")).toHaveCount(
    29,
  );
  await expect(item).toHaveAttribute("aria-checked", "true");
  await categories
    .getByRole("button", { name: /^Product & technical/ })
    .click();
  await expect(panel.getByRole("radiogroup").getByRole("radio")).toHaveCount(8);
  await expect(
    panel.getByRole("tabpanel").locator(".direction-current"),
  ).toContainText("Microscopic science");
  await panel
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/reference-browsing-improved.png",
  });
});
test("reference look and pacing have separate searchable directions and independent saved controls", async ({
  page,
}) => {
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  const panel = page.locator(".prompt-drawer");
  const tabs = panel.getByRole("tablist", { name: "Prompt sections" });
  await tabs.getByRole("tab", { name: "Reference look", exact: true }).click();
  await expect(panel.getByRole("tabpanel")).toHaveCount(1);
  const search = panel.getByLabel("Search reference looks", { exact: true });
  await search.fill("Kurzgesagt");
  const reference = panel.getByRole("radio", { name: /^Kurzgesagt-inspired/ });
  await reference.click();
  await expect(reference).toHaveAttribute("aria-checked", "true");
  await expect(
    panel.getByText("Example treatment", { exact: true }),
  ).toBeVisible();
  await panel
    .getByLabel("Reference influence", { exact: true })
    .selectOption("Subtle");
  await panel
    .getByLabel("Custom visual direction", { exact: true })
    .fill("Use muted copper instead of bright cyan");
  await page.screenshot({ path: "test-results/prompt-reference-studio.png" });
  await tabs
    .getByRole("tab", { name: "Editing & pacing", exact: true })
    .click();
  await panel
    .getByLabel("Search editing styles", { exact: true })
    .fill("Data story");
  await panel.getByRole("radio", { name: /^Data story/ }).click();
  await panel
    .getByLabel("Pacing energy", { exact: true })
    .selectOption("Calm / spacious");
  await panel
    .getByLabel("Transition preference", { exact: true })
    .selectOption("Hard cuts");
  await panel
    .getByLabel("Custom editing direction", { exact: true })
    .fill("Hold the final comparison for the narration");
  const output = panel.locator('textarea[aria-label="Generated prompt"]');
  for (const value of [
    "Kurzgesagt-inspired",
    "Reference influence: Subtle",
    "Use muted copper instead of bright cyan",
    "Data story",
    "Calm / spacious",
    "Explicit transition preference: Hard cuts",
    "Hold the final comparison for the narration",
  ])
    expect(await output.inputValue()).toContain(value);
  await page.screenshot({ path: "test-results/prompt-pacing-studio.png" });
  await page.reload();
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  await expect(
    tabs.getByRole("tab", { name: "Editing & pacing", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByLabel("Pacing energy", { exact: true })).toHaveValue(
    "Calm / spacious",
  );
  await tabs.getByRole("tab", { name: "Reference look", exact: true }).click();
  await expect(
    panel.getByLabel("Reference influence", { exact: true }),
  ).toHaveValue("Subtle");
  await search.fill("No matching visual");
  await expect(panel.getByText(/No matching presets/)).toBeVisible();
  await panel
    .getByRole("button", { name: "Clear search", exact: true })
    .click();
  await panel.getByRole("radio", { name: /^Original \/ no reference/ }).click();
  await expect(
    panel.getByLabel("Reference influence", { exact: true }),
  ).toBeDisabled();
  await expect(panel.getByRole("radio", { name: /^Data story/ })).toHaveCount(
    0,
  );
  expect(await output.inputValue()).toContain("Editing style: Data story");
  expect(await output.inputValue()).not.toContain(
    "Reference-inspired direction: Kurzgesagt",
  );
});
