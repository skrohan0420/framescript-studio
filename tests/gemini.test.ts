import { afterEach, expect, it, vi } from "vitest";
import { generate, models } from "../server/ai";
import { newProject } from "../shared/project";
afterEach(() => vi.unstubAllGlobals());
it("discovers paginated Gemini text models and prioritizes Flash", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        models: [
          {
            name: "models/gemini-pro",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/gemini-image",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
        nextPageToken: "next",
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        models: [
          {
            name: "models/gemini-flash",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  expect(
    (await models({ provider: "gemini", model: "", key: "secret" })).map(
      (m: { name: string }) => m.name,
    ),
  ).toEqual(["models/gemini-flash", "models/gemini-pro"]);
  expect(String(fetcher.mock.calls[1][0])).toContain("pageToken=next");
});
it("generates validated animation JSON with the selected model and reference", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    action: "update",
                    html: "<canvas></canvas>",
                    js: "window.renderFrame=()=>{}",
                    explanation: "Scene created",
                  }),
                },
              ],
            },
          },
        ],
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  const result = await generate(
    { provider: "gemini", model: "models/gemini-flash", key: "secret" },
    {
      project: newProject(),
      prompt: "Generate scene",
      history: [],
      images: ["data:image/png;base64,YQ=="],
    },
    new AbortController().signal,
  );
  expect(result.html).toBe("<canvas></canvas>");
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toContain("models/gemini-flash:generateContent");
  expect(options.headers["x-goog-api-key"]).toBe("secret");
  expect(
    JSON.parse(options.body).contents[0].parts[1].inlineData.mimeType,
  ).toBe("image/png");
});
it("reports exhausted quota without exposing the key", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: { message: "Quota exceeded secret" } },
          { status: 429 },
        ),
      ),
  );
  await expect(
    models({ provider: "gemini", model: "", key: "secret" }),
  ).rejects.toThrow("Quota exceeded [redacted]");
});
