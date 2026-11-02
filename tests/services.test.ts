// @vitest-environment node
import { it, expect, vi, afterEach } from "vitest";
import { checkService } from "../server/services";
afterEach(() => vi.unstubAllGlobals());
it.each(["chatgpt", "openai", "ollama"] as const)(
  "verifies %s catalog access without claiming inference or usage balances",
  async (id) => {
    const request = vi.fn(async (url: string) =>
      Response.json(
        id === "chatgpt"
          ? {
              models: [
                {
                  slug: "available-model",
                  display_name: "Available",
                  visibility: "list",
                },
              ],
            }
          : id === "openai"
            ? { data: [{ id: "available-model" }] }
            : url.endsWith("/tags")
              ? { models: [{ name: "local-model" }] }
              : { capabilities: ["completion"] },
      ),
    );
    vi.stubGlobal("fetch", request);
    const result = await checkService(
      id,
      id === "ollama" ? undefined : "test-secret",
    );
    expect(result.state).toBe("ready");
    expect(result.message).toContain("Generation has not been tested");
    expect(result.quota).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("test-secret");
  },
);
it("explains unreachable Ollama and empty installations", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("fetch failed")));
  expect((await checkService("ollama")).message).toContain("Start Ollama");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ models: [] })),
  );
  expect((await checkService("ollama")).message).toContain("no local models");
});
it("reads real provider subscription fields without inventing generation counts", async () => {
  const fetch = vi.fn(async (url: string) =>
    Response.json(
      new URL(url).pathname.endsWith("/voices")
        ? { voices: [{ voice_id: "v", name: "Voice" }] }
        : url.endsWith("/models")
          ? [
              {
                model_id: "eleven_v4",
                name: "Eleven v4",
                can_do_text_to_speech: true,
              },
            ]
          : {
              character_count: 1200,
              character_limit: 10000,
              tier: "starter",
              next_character_count_reset_unix: 1800000000,
            },
    ),
  );
  vi.stubGlobal("fetch", fetch);
  const result = await checkService("eleven", "test-secret");
  expect(result.state).toBe("ready");
  expect(result.quota).toEqual({
    used: 1200,
    limit: 10000,
    remaining: 8800,
    tier: "starter",
    resetAt: 1800000000,
  });
  expect(JSON.stringify(result)).not.toContain("test-secret");
  expect(
    fetch.mock.calls.some(
      ([url]) => url === "https://api.elevenlabs.io/v1/user/subscription",
    ),
  ).toBe(true);
});
it("keeps generation connection usable when restricted keys cannot read subscription usage", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.endsWith("/subscription")
        ? Response.json({ detail: "Forbidden" }, { status: 403 })
        : Response.json(
            new URL(url).pathname.endsWith("/voices")
              ? { voices: [{ voice_id: "v", name: "Voice" }] }
              : [
                  {
                    can_do_text_to_speech: true,
                    model_id: "test",
                    name: "Test",
                  },
                ],
          ),
    ),
  );
  const result = await checkService("eleven", "test-secret");
  expect(result.state).toBe("ready");
  expect(result.quota).toBeUndefined();
  expect(result.quotaError).toContain("subscription read access");
});
it("redacts bad key errors, avoids fabricated balances, and never falls back to another provider", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json(
        { error: { message: "Invalid test-secret" } },
        { status: 401 },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const result = await checkService("gemini", "test-secret");
  expect(result.state).toBe("error");
  expect(result.message).not.toContain("test-secret");
  expect(result.quota).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toContain(
    "generativelanguage.googleapis.com",
  );
});
it("does not call providers without credentials or pretend Flow is connected", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect((await checkService("chatgpt")).state).toBe("error");
  expect((await checkService("flow")).message).toContain("external handoff");
  expect(fetch).not.toHaveBeenCalled();
});
