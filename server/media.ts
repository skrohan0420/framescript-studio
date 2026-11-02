import { z } from "zod";
import { projectSchema, type Project } from "../shared/project";
import { transcriptWordSchema } from "../shared/transcript";
const keySchema = z.string().min(1).max(1000);
export async function transcribeAudio(
  key: string,
  input: { data: string; name: string },
) {
  if (!key)
    throw Error("Connect an ElevenLabs API key in Services to extract text.");
  const match =
    /^data:(audio\/[\w.+-]+|application\/octet-stream);base64,([A-Za-z0-9+/=]+)$/.exec(
      input.data,
    );
  if (!match) throw Error("Choose an imported audio file to transcribe.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 25000000)
    throw Error("Transcription supports audio files up to 25 MB.");
  const form = new FormData();
  form.set("model_id", "scribe_v2");
  form.set("tag_audio_events", "false");
  form.set("timestamps_granularity", "word");
  form.set(
    "file",
    new Blob([new Uint8Array(bytes)], { type: match[1] }),
    input.name,
  );
  const response = await checked(
    await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
      signal: AbortSignal.timeout(180000),
    }),
    key,
  );
  const raw = z
    .object({
      text: z.string().max(50000),
      words: z
        .array(
          z.object({
            text: z.string(),
            start: z.number(),
            end: z.number(),
            type: z.string().optional(),
          }),
        )
        .max(30000)
        .optional(),
    })
    .parse(await response.json());
  const result = {
    text: raw.text,
    words: (raw.words ?? [])
      .filter(
        (word) => (!word.type || word.type === "word") && word.text.trim(),
      )
      .map((word) => transcriptWordSchema.parse(word))
      .slice(0, 10000),
  };
  if (!result.text.trim()) throw Error("No speech was detected in this audio.");
  return result;
}
async function checked(response: Response, key: string) {
  if (response.ok) return response;
  let text = (await response.text())
    .split(key)
    .join("[redacted]")
    .slice(0, 1200);
  try {
    const data = JSON.parse(text);
    text = data.error?.message ?? data.detail?.message ?? data.detail ?? text;
  } catch {}
  throw Error(
    `Media provider ${response.status}: ${typeof text === "string" ? text : JSON.stringify(text)}`,
  );
}
export async function googleImageModels(key: string) {
  keySchema.parse(key);
  const signal = AbortSignal.timeout(15000),
    result = new Map<string, { id: string; name: string }>(),
    seen = new Set<string>();
  let token = "";
  do {
    if (seen.has(token) || seen.size >= 50)
      throw Error("Gemini returned an incomplete model catalog. Try again.");
    seen.add(token);
    const url = new URL(
      "https://generativelanguage.googleapis.com/v1beta/models",
    );
    if (token) url.searchParams.set("pageToken", token);
    const r = await checked(
      await fetch(url.href, { headers: { "x-goog-api-key": key }, signal }),
      key,
    );
    const data = await r.json();
    if (!Array.isArray(data.models))
      throw Error("Unexpected Gemini model catalog.");
    for (const m of data.models)
      if (
        typeof m.name === "string" &&
        m.name.includes("image") &&
        m.supportedGenerationMethods?.includes("generateContent")
      )
        result.set(m.name, { id: m.name, name: m.displayName ?? m.name });
    token = typeof data.nextPageToken === "string" ? data.nextPageToken : "";
  } while (token);
  return [...result.values()];
}
export async function elevenSubscription(key: string) {
  keySchema.parse(key);
  const response = await checked(
    await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(15000),
    }),
    key,
  );
  const subscription = z
    .object({
      character_count: z.number().nonnegative(),
      character_limit: z.number().nonnegative(),
      next_character_count_reset_unix: z.number().nullable().optional(),
      tier: z.string().optional(),
    })
    .parse(await response.json());
  return {
    used: subscription.character_count,
    limit: subscription.character_limit,
    remaining: Math.max(
      0,
      subscription.character_limit - subscription.character_count,
    ),
    resetAt: subscription.next_character_count_reset_unix ?? undefined,
    tier: subscription.tier,
  };
}
export async function generateImage(
  key: string,
  value: unknown,
  signal: AbortSignal,
) {
  keySchema.parse(key);
  const request = z
    .object({
      model: z.string().regex(/^(models\/)?[a-zA-Z0-9._-]+$/),
      prompt: z.string().min(1).max(15000),
      references: z.array(z.string()).max(10),
      project: projectSchema,
    })
    .parse(value);
  const refs = request.references.map((id) => {
    const asset = request.project.assets.find((a) => a.id === id);
    if (!asset) throw Error("Reference asset not found");
    const match = asset.data.match(
      /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s,
    );
    if (!match)
      throw Error("For image generation, use PNG, JPEG or WebP references.");
    return { inlineData: { mimeType: match[1], data: match[2] } };
  });
  const model = request.model.replace(/^models\//, "");
  const r = await checked(
    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: request.prompt }, ...refs] },
          ],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        signal,
      },
    ),
    key,
  );
  const result = await r.json(),
    parts =
      result.candidates?.flatMap((c: any) => c.content?.parts ?? []) ?? [];
  const img = parts.find((p: any) =>
    p.inlineData?.mimeType?.startsWith("image/"),
  )?.inlineData;
  if (!img?.data)
    throw Error(
      "No image was returned. " +
        (result.promptFeedback?.blockReason ??
          result.candidates?.[0]?.finishReason ??
          "Check model capability and account access."),
    );
  const data = `data:${img.mimeType};base64,${img.data}`;
  if (data.length > 30_000_000)
    throw Error("Generated image is too large for the project.");
  return { data };
}
export async function elevenCatalog(key: string) {
  keySchema.parse(key);
  const headers = { "xi-api-key": key };
  const signal = AbortSignal.timeout(15000);
  const loadVoices = async () => {
    const voices = new Map<string, { id: string; name: string }>(),
      seen = new Set<string>();
    let token = "";
    do {
      if (seen.has(token) || seen.size >= 50)
        throw Error(
          "ElevenLabs returned an incomplete voice catalog. Try again.",
        );
      seen.add(token);
      const url = new URL("https://api.elevenlabs.io/v2/voices");
      url.searchParams.set("page_size", "100");
      if (token) url.searchParams.set("next_page_token", token);
      const response = await checked(
          await fetch(url.href, { headers, signal }),
          key,
        ),
        data = await response.json();
      if (!Array.isArray(data.voices))
        throw Error("Unexpected ElevenLabs voice catalog.");
      for (const voice of data.voices)
        voices.set(voice.voice_id, { id: voice.voice_id, name: voice.name });
      if (data.has_more && !data.next_page_token)
        throw Error("ElevenLabs voice pagination is incomplete. Try again.");
      token = data.has_more ? data.next_page_token : "";
    } while (token);
    return [...voices.values()];
  };
  const [voices, models] = await Promise.all([
    loadVoices(),
    (async () => {
      const response = await checked(
        await fetch("https://api.elevenlabs.io/v1/models", { headers, signal }),
        key,
      );
      const data = await response.json();
      if (!Array.isArray(data))
        throw Error("Unexpected ElevenLabs model catalog.");
      return data;
    })(),
  ]);
  return {
    voices,
    models: models
      .filter((m: any) => m.can_do_text_to_speech)
      .map((m: any) => ({ id: m.model_id, name: m.name })),
  };
}
export async function elevenAudio(
  key: string,
  value: unknown,
  signal: AbortSignal,
) {
  keySchema.parse(key);
  const request = z
    .object({
      type: z.enum(["voice", "sfx"]),
      text: z.string().min(1).max(10000),
      voice: z.string().max(200).optional(),
      model: z.string().max(200).optional(),
      duration: z.number().min(0.5).max(30).optional(),
    })
    .parse(value);
  if (request.type === "voice" && !request.voice)
    throw Error("Select an ElevenLabs voice.");
  const url =
    request.type === "voice"
      ? `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(request.voice!)}`
      : "https://api.elevenlabs.io/v1/sound-generation";
  const body =
    request.type === "voice"
      ? { text: request.text, model_id: request.model ?? "eleven_v4" }
      : {
          text: request.text,
          duration_seconds: request.duration ?? 2,
          model_id: "eleven_text_to_sound_v2",
        };
  const r = await checked(
    await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    }),
    key,
  );
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length > 30_000_000) throw Error("Generated audio exceeds 30 MB");
  const mime = r.headers.get("content-type")?.split(";")[0] ?? "audio/mpeg";
  if (!mime.startsWith("audio/")) throw Error("Provider did not return audio.");
  return { data: `data:${mime};base64,${bytes.toString("base64")}` };
}
