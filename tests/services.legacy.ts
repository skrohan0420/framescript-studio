// Historical browser scenarios for the former UI. See tests/README.md.
import { test, expect } from "@playwright/test";
import { synthesizeSound } from "../shared/audio";
test("Services refreshes ChatGPT sign-in status while Ollama stays selected", async ({
  page,
}) => {
  await page.route("**/api/recover", (r) =>
    r.fulfill({ json: { result: null } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: { provider: "ollama" } } }),
  );
  await page.route("**/api/chatgptStatus", (r) =>
    r.fulfill({
      json: {
        result: {
          connected: true,
          pending: false,
          email: "connected@example.com",
          planEnabled: true,
        },
      },
    }),
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page.getByRole("button", { name: "Services", exact: true }).click();
  await expect(
    page.getByText("Connected · connected@example.com", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "AI provider" })).toHaveValue(
    "ollama",
  );
});
test("connected media services load catalogs and produce scene audio and mascot assets", async ({
  page,
}) => {
  await page.route("**/api/recover", (r) =>
    r.fulfill({ json: { result: null } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: { provider: "ollama" } } }),
  );
  await page.route("**/api/mediaStatus", (r) =>
    r.fulfill({ json: { result: { gemini: true, eleven: true } } }),
  );
  await page.route("**/api/elevenCatalog", (r) =>
    r.fulfill({
      json: {
        result: {
          voices: [{ id: "voice", name: "Test voice" }],
          models: [{ id: "available-model", name: "Available model" }],
        },
      },
    }),
  );
  await page.route("**/api/imageModels", (r) =>
    r.fulfill({
      json: { result: [{ id: "models/test-image", name: "Test image model" }] },
    }),
  );
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=";
  let audioRequests = 0;
  await page.route("**/api/generateAudio", (r) => {
    const req = r.request().postDataJSON().args[0];
    audioRequests++;
    if (req.type === "voice")
      expect(req).toMatchObject({
        voice: "voice",
        model: "available-model",
        text: "A test narration.",
      });
    return r.fulfill({
      json: { result: { data: synthesizeSound("Success chime").data } },
    });
  });
  await page.route("**/api/generateImage", (r) => {
    const req = r.request().postDataJSON().args[0];
    expect(req.model).toBe("models/test-image");
    expect(req.references).toHaveLength(1);
    return r.fulfill({
      json: { result: { data: "data:image/png;base64," + png } },
    });
  });
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page.getByRole("button", { name: "Storyboard", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Storyboard & production workflow",
  });
  await dialog
    .locator(".workflow-tabs")
    .getByRole("button", { name: "Scenes", exact: true })
    .click();
  await dialog
    .getByRole("textbox", { name: "Narration", exact: true })
    .fill("A test narration.");
  await dialog
    .locator(".workflow-tabs")
    .getByRole("button", { name: "Voice", exact: true })
    .click();

  await dialog.getByRole("button", { name: "Load voices & models" }).click();
  await expect(dialog.getByLabel("Speech model", { exact: true })).toHaveValue(
    "available-model",
  );
  await dialog
    .getByRole("button", { name: "Generate narration take", exact: true })
    .click();
  await expect(dialog.locator(".audio-clip")).toHaveCount(1);
  await dialog
    .getByRole("button", { name: "SFX & Music", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Generate SFX", exact: true })
    .click();
  await expect(dialog.locator(".audio-clip")).toHaveCount(1);
  expect(audioRequests).toBe(2);
  await dialog
    .locator(".workflow-tabs")
    .getByRole("button", { name: "Mascot & images", exact: true })
    .click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    dialog
      .getByRole("button", { name: "Upload references", exact: true })
      .click(),
  ]);
  await chooser.setFiles({
    name: "mascot.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await dialog
    .getByText("Optional in-app generation · Gemini API", { exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Load image models", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Generate variant with Gemini", exact: true })
    .click();
  await expect(dialog.locator(".mascot-assets img")).toHaveCount(2);
});
test("services centralizes keys, honest limits, rechecks and credential removal", async ({
  page,
}) => {
  let configured = false,
    checked = false;
  const secret = "fake-eleven-key-for-ui-test";
  await page.route("**/api/recover", (r) =>
    r.fulfill({ json: { result: null } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: { provider: "ollama" } } }),
  );
  await page.route("**/api/servicesStatus", (r) =>
    r.fulfill({
      json: {
        result: [
          { id: "chatgpt", configured: false, source: "account" },
          {
            id: "eleven",
            configured,
            source: configured ? "session" : "none",
            check: checked
              ? {
                  state: "ready",
                  checkedAt: new Date().toISOString(),
                  message: "Connected · 3 voices available",
                  quota: {
                    used: 1200,
                    limit: 10000,
                    remaining: 8800,
                    resetAt: 1800000000,
                    tier: "Starter",
                  },
                }
              : undefined,
          },
          { id: "flow", configured: false, source: "external" },
          { id: "gemini", configured: false, source: "none" },
          { id: "openai", configured: false, source: "none" },
          { id: "ollama", configured: true, source: "local" },
        ],
      },
    }),
  );
  await page.route("**/api/mediaCredentials", (r) => {
    expect(r.request().postDataJSON().args).toEqual(["eleven", secret, true]);
    configured = true;
    return r.fulfill({ json: { result: true } });
  });
  await page.route("**/api/serviceCheck", (r) => {
    expect(r.request().postDataJSON().args).toEqual(["eleven"]);
    checked = true;
    return r.fulfill({ json: { result: { state: "ready" } } });
  });
  await page.route("**/api/serviceRemove", (r) => {
    expect(r.request().postDataJSON().args).toEqual(["eleven"]);
    configured = false;
    checked = false;
    return r.fulfill({ json: { result: true } });
  });
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page.getByRole("button", { name: "Services", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Services & connections" });
  await expect(dialog.getByRole("article")).toHaveCount(6);
  const chat = dialog.getByRole("article", { name: "ChatGPT service" });
  await expect(
    chat.getByRole("button", { name: "Continue with ChatGPT", exact: true }),
  ).toBeVisible();
  await expect(chat).toContainText("Unavailable");
  const flow = dialog.getByRole("article", { name: "Google Flow service" });
  await expect(flow).toContainText("External handoff");
  await expect(
    flow.getByRole("link", { name: "Continue in Google Flow" }),
  ).toHaveAttribute("href", "https://labs.google/fx/tools/flow");
  const eleven = dialog.getByRole("article", { name: "ElevenLabs service" });
  await eleven.getByText("API key setup · secondary", { exact: true }).click();
  await eleven.getByLabel("ElevenLabs API key", { exact: true }).fill(secret);
  await eleven.getByRole("button", { name: "Save & check key" }).click();
  await expect(eleven).toContainText("8,800 credits remaining");
  await expect(eleven.getByRole("progressbar")).toHaveAttribute(
    "value",
    "8800",
  );
  await expect(
    eleven.getByLabel("ElevenLabs API key", { exact: true }),
  ).toHaveValue("");
  await expect(page.locator("body")).not.toContainText(secret);
  await page.screenshot({ path: "test-results/services.png" });
  await eleven.getByRole("button", { name: "Forget connection" }).click();
  await expect(eleven).toContainText("No key configured");
  await expect(eleven).not.toContainText("8,800");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Storyboard", exact: true }).click();
  const workflow = page.getByRole("dialog", {
    name: "Storyboard & production workflow",
  });
  await workflow
    .locator(".workflow-tabs")
    .getByRole("button", { name: "Voice", exact: true })
    .click();

  await expect(workflow.locator("input[type=password]")).toHaveCount(0);
  await workflow
    .getByRole("button", { name: "Manage voice connection in Services" })
    .click();
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(workflow).toBeVisible();
  await expect(
    workflow.getByRole("heading", { name: "Voice generation" }),
  ).toBeVisible();
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: null } }),
  );
});
