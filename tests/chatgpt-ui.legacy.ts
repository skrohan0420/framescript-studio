// Historical browser scenarios for the former UI. See tests/README.md.
import { test, expect } from "@playwright/test";
test("generation progress is visible in chat and connected account controls stay compact", async ({
  page,
}) => {
  await page.route("**/api/recover", (r) =>
    r.fulfill({ json: { result: null } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: { provider: "chatgpt" } } }),
  );
  await page.route("**/api/chatgptStatus", (r) =>
    r.fulfill({
      json: {
        result: {
          connected: true,
          pending: false,
          planEnabled: true,
          email: "account@example.com",
        },
      },
    }),
  );
  await page.route("**/api/models", (r) =>
    r.fulfill({
      json: { result: [{ name: "test-model", label: "GPT test model" }] },
    }),
  );
  await page.route("**/api/events", (r) =>
    r.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"kind":"ai","stage":"Receiving animation code","characters":2900}\n\n',
    }),
  );
  let finish!: () => void;
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/generate", async (r) => {
    await done;
    await r.fulfill({
      status: 400,
      json: { result: { error: "Generation cancelled" } },
    });
  });
  await page.route("**/api/cancelAI", (r) => {
    finish();
    return r.fulfill({ json: { result: true } });
  });
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "AI model" })).toHaveValue(
    "test-model",
  );
  const account = page.locator(".chatgpt-connection");
  await expect(account).toHaveAttribute("aria-label", "Manage services");
  expect((await account.boundingBox())!.height).toBeLessThan(45);
  await page
    .getByRole("textbox", { name: "Animation prompt" })
    .fill("Create a glowing solar system");
  await page
    .getByRole("button", { name: "Generate animation", exact: true })
    .click();
  const card = page.getByRole("region", {
    name: "Animation generation progress",
  });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Building your animation");
  await expect(card).toContainText("2,900");
  await expect(card.getByRole("progressbar")).not.toHaveAttribute(
    "aria-valuenow",
  );
  await page.screenshot({ path: "test-results/chat-progress.png" });
  await card
    .getByRole("button", { name: "Cancel generation", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await expect(page.locator(".chat-message.assistant").last()).toContainText(
    "Generation cancelled",
  );
});
test("ChatGPT sign-in opens official authorization, loads models, generates code and signs out", async ({
  page,
  context,
}) => {
  let connected = false,
    pending = false;
  await page.route("**/api/recover", (r) =>
    r.fulfill({ json: { result: null } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: { provider: "chatgpt" } } }),
  );
  await page.route("**/api/chatgptStatus", (r) =>
    r.fulfill({
      json: {
        result: {
          connected,
          pending,
          planEnabled: connected,
          email: connected ? "account@example.com" : undefined,
        },
      },
    }),
  );
  await context.route("https://auth.openai.com/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<h1>Mock official authorization page</h1>",
    }),
  );
  await page.route("**/api/chatgptConnect", (r) => {
    pending = true;
    return r.fulfill({
      json: {
        result: {
          url: "https://auth.openai.com/api/accounts/authorize?state=mock-browser-flow",
        },
      },
    });
  });
  await page.route("**/api/chatgptDisconnect", (r) => {
    connected = false;
    pending = false;
    return r.fulfill({ json: { result: { warning: "" } } });
  });
  await page.route("**/api/models", (r) =>
    r.fulfill({
      json: { result: [{ name: "account-model", label: "My account model" }] },
    }),
  );
  await page.route("**/api/generate", (r) => {
    expect(r.request().postDataJSON().args[0]).toMatchObject({
      provider: "chatgpt",
      model: "account-model",
    });
    return r.fulfill({
      json: {
        result: {
          action: "update",
          html: '<h1 id="chatgpt-result">Connected generation</h1>',
          css: "h1{color:white}",
          js: "",
          explanation: "Generated scene",
        },
      },
    });
  });
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page.getByRole("button", { name: "Services", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continue with ChatGPT", exact: true }),
  ).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Continue with ChatGPT", exact: true })
    .click();
  const popup = await popupPromise;
  await popup.waitForURL("https://auth.openai.com/**");
  await expect(
    page.getByText("Finish signing in in the opened tab.", { exact: false }),
  ).toBeVisible();
  connected = true;
  pending = false;
  await popup.close();
  await expect(
    page.getByText("Connected · account@example.com", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "AI model" })).toHaveValue(
    "account-model",
  );
  await page
    .getByRole("textbox", { name: "Animation prompt" })
    .fill("Create a title");
  await page
    .getByRole("button", { name: "Generate animation", exact: true })
    .click();
  await expect(
    page
      .frameLocator('iframe[title="Animation preview"]')
      .locator("#chatgpt-result"),
  ).toHaveText("Connected generation");
  await page.getByRole("button", { name: "Services", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continue with ChatGPT", exact: true }),
  ).toBeVisible();
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: null } }),
  );
});
