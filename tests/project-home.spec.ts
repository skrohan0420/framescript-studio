import { test, expect } from "@playwright/test";
test("home creates, saves, renames, duplicates, trashes and restores projects", async ({
  page,
}) => {
  const name = "Orbit " + Date.now();
  await page.goto("/");
  await expect(page).toHaveTitle("Projects · FrameScript Studio");
  const favicon = await page.request.get("/favicon.svg");
  expect(favicon.ok()).toBe(true);
  expect(favicon.headers()["content-type"]).toContain("image/svg+xml");
  await expect(
    page.getByRole("heading", { name: "Let’s make something move." }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Create project A blank canvas for your next idea",
    })
    .click();
  const create = page.getByRole("dialog", {
    name: "Create project",
    exact: true,
  });
  await create.getByLabel("New project name").fill(name);
  await create
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Project name", exact: true }),
  ).toHaveValue(name);
  await expect(page).toHaveTitle(`${name} · FrameScript Studio`);
  await page.getByRole("button", { name: "Project home", exact: true }).click();
  await expect(page).toHaveTitle("Projects · FrameScript Studio");
  await expect(
    page.getByRole("button", { name: `Open ${name}`, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Rename ${name}`, exact: true })
    .click();
  const rename = page.getByRole("dialog", {
    name: "Rename project",
    exact: true,
  });
  await rename.getByLabel("Project title").fill(name + " updated");
  await rename.getByRole("button", { name: "Save name", exact: true }).click();
  await page
    .getByRole("button", { name: `Duplicate ${name} updated`, exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: `Open ${name} updated copy`,
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Move ${name} updated to trash`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Open ${name} updated`, exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await page
    .getByRole("button", { name: `Restore ${name} updated`, exact: true })
    .click();
  await page.getByRole("button", { name: "All projects", exact: true }).click();
  await page
    .getByRole("button", { name: `Open ${name} updated`, exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Project name", exact: true }),
  ).toHaveValue(name + " updated");
});
test("home presents a searchable grid and list layout", async ({ page }) => {
  const names = [
    "Stellar origins",
    "A journey through space",
    "The smallest things",
    "Motion study 04",
    "Solar currents",
    "Beyond the visible",
    "A new perspective",
    "Particles in motion",
  ];
  await page.route("**/api/projectList", (route) =>
    route.fulfill({
      json: {
        result: names.map((name, index) => ({
          id: index + ".frame",
          name,
          updated: Date.now() - index * 86400000,
          duration: 20 + index * 5,
          width: 3840,
          height: 2160,
          scenes: index + 1,
        })),
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator(".home-project-card")).toHaveCount(8);
  await page.screenshot({ path: "test-results/project-home.png" });
  await page.getByLabel("Search projects").fill("Stellar");
  await expect(page.locator(".home-project-card")).toHaveCount(1);
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await expect(page.locator(".home-project-grid")).toHaveClass(/list/);
});
