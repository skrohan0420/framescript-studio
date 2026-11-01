import { z } from "zod";
import { projectSchema, type Project } from "../shared/project";
const keySchema = z.string().min(1).max(1000);
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
  const r = await checked(
    await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(15000),
    }),
    key,
  );
  return (
    (await r.json()).models
      ?.filter(
        (m: any) =>
          m.name.includes("image") &&
          m.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((m: any) => ({ id: m.name, name: m.displayName })) ?? []
  );
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
  const [voices, models] = await Promise.all([
    fetch("https://api.elevenlabs.io/v1/voices", {
      headers,
      signal: AbortSignal.timeout(15000),
    }),
    fetch("https://api.elevenlabs.io/v1/models", {
      headers,
      signal: AbortSignal.timeout(15000),
    }),
  ]);
  await checked(voices, key);
  await checked(models, key);
  return {
    voices: (await voices.json()).voices.map((v: any) => ({
      id: v.voice_id,
      name: v.name,
    })),
    models: (await models.json())
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
