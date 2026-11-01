// @vitest-environment node
import { it, expect, vi, afterEach } from "vitest";
import {
  googleImageModels,
  generateImage,
  elevenAudio,
  elevenCatalog,
} from "../server/media";
import { newProject } from "../shared/project";
import { synthesizeSound } from "../shared/audio";
afterEach(() => vi.unstubAllGlobals());
it("creates real RIFF/WAV data for local sound and music presets", () => {
  for (const name of ["Soft pop", "Whoosh", "Ambient loop"]) {
    const clip = synthesizeSound(name),
      data = Buffer.from(clip.data.split(",")[1], "base64");
    expect(data.subarray(0, 4).toString()).toBe("RIFF");
    expect(data.subarray(8, 12).toString()).toBe("WAVE");
    expect(data.length).toBeGreaterThan(1000);
    expect(clip.peaks.some((p) => p > 0)).toBe(true);
  }
});
it("sends actual reference images to the official Gemini API and keeps keys out of request bodies", async () => {
  const p = newProject();
  p.assets = [
    {
      id: "reference",
      name: "mascot.png",
      data: "data:image/png;base64,AAAA",
      kind: "reference",
    },
  ];
  const request = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: "image/png", data: "BBBB" } }],
            },
          },
        ],
      }),
    );
  vi.stubGlobal("fetch", request);
  expect(
    (
      await generateImage(
        "secret",
        {
          project: p,
          model: "models/test-image",
          prompt: "Waving mascot",
          references: ["reference"],
        },
        new AbortController().signal,
      )
    ).data,
  ).toBe("data:image/png;base64,BBBB");
  expect(request.mock.calls[0][0]).toBe(
    "https://generativelanguage.googleapis.com/v1beta/models/test-image:generateContent",
  );
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body.contents[0].parts[1].inlineData.data).toBe("AAAA");
  expect(request.mock.calls[0][1].body).not.toContain("secret");
});
it("validates image references and safely reports provider failures", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(
      Response.json(
        { error: { message: "No access for secret" } },
        { status: 403 },
      ),
    );
  vi.stubGlobal("fetch", request);
  await expect(googleImageModels("secret")).rejects.toThrow("[redacted]");
  await expect(
    generateImage(
      "secret",
      {
        project: newProject(),
        model: "../../bad",
        prompt: "x",
        references: [],
      },
      new AbortController().signal,
    ),
  ).rejects.toThrow();
});
it("uses the selected Eleven v4 voice without rewriting the supplied narration", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
  vi.stubGlobal("fetch", request);
  const result = await elevenAudio(
    "voice-secret",
    {
      type: "voice",
      voice: "my-voice",
      model: "eleven_v4",
      text: "Exact narration.",
    },
    new AbortController().signal,
  );
  expect(result.data).toBe("data:audio/mpeg;base64,AQID");
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({
    text: "Exact narration.",
    model_id: "eleven_v4",
  });
  expect(request.mock.calls[0][1].headers["xi-api-key"]).toBe("voice-secret");
});
