// @vitest-environment node
import { it, expect, vi, afterEach } from "vitest";
import {
  googleImageModels,
  generateImage,
  elevenAudio,
  elevenCatalog,
  transcribeAudio,
} from "../server/media";
import { newProject } from "../shared/project";
import { synthesizeSound } from "../shared/audio";
afterEach(() => vi.unstubAllGlobals());
it("transcribes audio through multipart upload and rejects missing credentials", async () => {
  const request = vi.fn().mockResolvedValue(Response.json({ text: "Hello from the voiceover." }));
  vi.stubGlobal("fetch", request);
  const input = { data: "data:audio/mpeg;base64,SGVsbG8=", name: "voice.mp3" };
  await expect(transcribeAudio("", input)).rejects.toThrow("Connect an ElevenLabs");
  expect(request).not.toHaveBeenCalled();
  expect(await transcribeAudio("test-key", input)).toEqual({ text: "Hello from the voiceover.", words: [] });
  const [url, options] = request.mock.calls[0];
  expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
  expect(options.body.get("model_id")).toBe("scribe_v2");
  expect(options.body.get("file").name).toBe("voice.mp3");
  request.mockResolvedValueOnce(Response.json({ text: "" }));
  await expect(transcribeAudio("test-key", input)).rejects.toThrow("No speech");
});
it("loads Gemini image models beyond the first page and deduplicates catalog entries", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        models: [
          {
            name: "models/text",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
        nextPageToken: "page two",
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        models: [
          {
            name: "models/test-image",
            displayName: "Image",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/test-image",
            displayName: "Image",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      }),
    );
  vi.stubGlobal("fetch", request);
  expect(await googleImageModels("secret")).toEqual([
    { id: "models/test-image", name: "Image" },
  ]);
  expect(request.mock.calls[1][0]).toContain("pageToken=page+two");
});
it("loads the current ElevenLabs voice endpoint across pages", async () => {
  const request = vi.fn(async (url: string) =>
    Response.json(
      url.endsWith("/models")
        ? [
            {
              model_id: "eleven_v4",
              name: "Eleven v4",
              can_do_text_to_speech: true,
            },
          ]
        : url.includes("next_page_token")
          ? { voices: [{ voice_id: "b", name: "B" }], has_more: false }
          : {
              voices: [{ voice_id: "a", name: "A" }],
              has_more: true,
              next_page_token: "two",
            },
    ),
  );
  vi.stubGlobal("fetch", request);
  expect((await elevenCatalog("secret")).voices).toEqual([
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ]);
  expect(
    request.mock.calls.some(
      ([url]) =>
        url.includes("/v2/voices?") && url.includes("next_page_token=two"),
    ),
  ).toBe(true);
});
it("rejects repeated catalog pagination tokens rather than hanging indefinitely", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(Response.json({ models: [], nextPageToken: "same" })),
      ),
  );
  await expect(googleImageModels("secret")).rejects.toThrow(
    "incomplete model catalog",
  );
});
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
  const request = vi.fn().mockResolvedValue(
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
  const request = vi.fn().mockResolvedValue(
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
