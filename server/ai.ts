import { aiSchema, projectSchema, type Project } from "../shared/project";
import type { z } from "zod";
export interface AIConfig {
  provider: "ollama" | "openai" | "chatgpt" | "gemini";
  model: string;
  key?: string;
}
export interface AIRequest {
  project: Project;
  prompt: string;
  history: { role: string; content: string }[];
  images: string[];
  error?: string;
  selection?: unknown;
}
const instruction = `You are FrameScript Studio's animation developer. Default to visual-only animation: do not add headlines, captions, labels, subtitles, typography, logos or decorative text unless the user explicitly asks for on-screen text. Narration and scene titles are context, not text to display. Existing storyboard visual directions requesting titles do not override this default. When revising a scene, remove unsolicited text overlays unless the user explicitly asks to keep them. Return ONLY a JSON object with action (create or update), optional html/css/js strings (omit unchanged fields), optional settings (width,height,duration,fps,speed,background,loop,timing), optional assets (array of EXISTING asset ids), and explanation (short string). No markdown. Use asset://ID for actual imported assets. Preserve existing code unless replacement requested. For deterministic JavaScript/Canvas animation define window.renderFrame = (timeInSeconds) => {...}; do not rely on requestAnimationFrame or timers for seek mode. CSS animations are seekable. No external scripts or network resources. Use CSS dimensions relative to project canvas. When project.brand is present, use its palette, font and background consistently unless the user explicitly overrides them. No secrets, filesystem, or Node APIs. Complete replacements for individual fields, not textual diffs.`;
export async function models(config: AIConfig, signal?: AbortSignal) {
  if (config.provider === "gemini") {
    if (!config.key)
      throw Error("Add a Google AI Studio API key in Services → Gemini first.");
    const result = new Map<
      string,
      { name: string; label: string; vision: boolean }
    >();
    let token = "";
    const seen = new Set<string>();
    do {
      if (seen.has(token) || seen.size >= 50)
        throw Error("Incomplete Gemini model catalog. Refresh and retry.");
      seen.add(token);
      const url = new URL(
        "https://generativelanguage.googleapis.com/v1beta/models",
      );
      if (token) url.searchParams.set("pageToken", token);
      const r = await fetch(url, {
        headers: { "x-goog-api-key": config.key },
        signal,
      });
      if (!r.ok) throw await geminiError(r, config.key);
      const data = await r.json();
      if (!Array.isArray(data.models))
        throw Error("Unexpected Gemini model catalog.");
      for (const m of data.models)
        if (
          typeof m.name === "string" &&
          /^models\/gemini-/.test(m.name) &&
          !/image|tts|live|robotics|computer-use/.test(m.name) &&
          m.supportedGenerationMethods?.includes("generateContent")
        )
          result.set(m.name, {
            name: m.name,
            label: m.displayName ?? m.name,
            vision: true,
          });
      token = typeof data.nextPageToken === "string" ? data.nextPageToken : "";
    } while (token);
    return [...result.values()].sort(
      (a, b) =>
        Number(!a.name.includes("flash")) - Number(!b.name.includes("flash")) ||
        a.name.localeCompare(b.name),
    );
  }
  if (config.provider === "chatgpt") {
    if (!config.key) throw Error("Connect your ChatGPT account first.");
    const r = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${config.key}` },
      signal,
    });
    if (!r.ok) throw await chatGPTError(r, config.key);
    const data = await r.json();
    if (!Array.isArray(data.models))
      throw Error("Unexpected ChatGPT model catalog. Reconnect your account.");
    return data.models
      .filter((m: any) => m.visibility === "list")
      .map((m: any) => ({
        name: m.slug,
        label: m.display_name,
        vision: false,
      }));
  }
  if (config.provider === "openai") {
    if (!config.key)
      throw Error(
        "OpenAI API key is missing. Add a key in Services or choose the ChatGPT account provider.",
      );
    const r = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${config.key}` },
      signal,
    });
    if (!r.ok) throw Error(`OpenAI ${r.status}: ${await r.text()}`);
    return (await r.json()).data.map((m: any) => ({
      name: m.id,
      vision: true,
    }));
  }
  const r = await fetch("http://127.0.0.1:11434/api/tags", { signal });
  if (!r.ok)
    throw Error(
      "Ollama did not respond. Install Ollama, run it, then pull a model.",
    );
  const data = await r.json();
  return Promise.all(
    data.models.map(async (m: any) => {
      const info = await fetch("http://127.0.0.1:11434/api/show", {
        method: "POST",
        body: JSON.stringify({ model: m.name }),
        signal,
      }).then((r) => r.json());
      return {
        name: m.name,
        vision: info.capabilities?.includes("vision") ?? false,
      };
    }),
  );
}
export async function generate<T = z.infer<typeof aiSchema>>(
  config: AIConfig,
  req: AIRequest,
  signal: AbortSignal,
  onProgress?: (progress: {
    kind: "ai";
    stage: string;
    characters: number;
  }) => void,
  options?: { instruction: string; schema: z.ZodType<T> },
): Promise<T> {
  const systemInstruction = options?.instruction ?? instruction;
  const p = projectSchema.parse(req.project);
  if (!req.prompt?.trim() || req.prompt.length > 30000)
    throw Error("Enter a prompt under 30,000 characters");
  if (req.images.length && config.provider === "ollama") {
    const installed = await models(config, signal);
    if (!installed.find((m: any) => m.name === config.model)?.vision)
      throw Error(
        "This model does not support vision. Choose a vision model or remove image attachments; imported assets remain available by ID.",
      );
  }
  const context = JSON.stringify({
    project: {
      ...p,
      audio: p.audio?.map(({ data, ...clip }) => clip),
      workflow: p.workflow
        ? {
            ...p.workflow,
            scenes: p.workflow.scenes.map(
              ({ html, css, js, ...scene }) => scene,
            ),
          }
        : undefined,
      assets: p.assets.map(({ id, name }) => ({
        id,
        name,
        reference: `asset://${id}`,
      })),
    },
    selection: req.selection,
    error: req.error,
  });
  const messages: any[] = [
    { role: "system", content: systemInstruction },
    ...req.history
      .slice(-10)
      .filter((m) => ["user", "assistant"].includes(m.role))
      .map(({ role, content }) => ({ role, content })),
    {
      role: "user",
      content: `Project context: ${context}\nRequest: ${req.prompt}`,
    },
  ];
  let result: string;
  if (config.provider === "chatgpt") {
    if (!config.key) throw Error("Connect your ChatGPT account first.");
    const input = messages.slice(1).map((m) => ({ ...m }));
    if (req.images.length) {
      const last = input.at(-1)!;
      last.content = [
        { type: "input_text", text: last.content },
        ...req.images.map((url) => ({ type: "input_image", image_url: url })),
      ];
    }
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        instructions: systemInstruction,
        input,
        store: false,
        stream: true,
      }),
      signal,
    });
    if (!r.ok) throw await chatGPTError(r, config.key);
    result = await readChatGPTStream(r, onProgress);
  } else if (config.provider === "gemini") {
    if (!config.key)
      throw Error("Add a Google AI Studio API key in Services → Gemini first.");
    if (!/^(models\/)?[a-zA-Z0-9._-]+$/.test(config.model))
      throw Error("Select a Gemini model first.");
    const contents = messages
      .slice(1)
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content } as any],
      }));
    for (const image of req.images) {
      const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(image);
      if (!match)
        throw Error("Gemini references must be PNG, JPEG or WebP images.");
      contents
        .at(-1)!
        .parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
    onProgress?.({
      kind: "ai",
      stage: "Gemini is generating animation code",
      characters: 0,
    });
    const name = config.model.startsWith("models/")
      ? config.model
      : "models/" + config.model;
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${name}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.key,
        },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );
    if (!r.ok) throw await geminiError(r, config.key);
    const data = await r.json(),
      candidate = data.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== "STOP")
      throw Error(
        `Gemini response incomplete: ${candidate.finishReason}. Try a shorter scene or another model.`,
      );
    result =
      candidate?.content?.parts
        ?.filter((p: any) => !p.thought && typeof p.text === "string")
        .map((p: any) => p.text)
        .join("") ?? "";
    if (!result)
      throw Error(
        "Gemini returned no animation code. Try another prompt or model.",
      );
  } else if (config.provider === "ollama") {
    if (req.images.length)
      messages[messages.length - 1].images = req.images.map(
        (i) => i.split(",")[1],
      );
    const r = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        format: "json",
      }),
      signal,
    });
    if (!r.ok) throw Error(`Ollama ${r.status}: ${await r.text()}`);
    result = (await r.json()).message.content;
  } else {
    if (!config.key) throw Error("Configure an OpenAI API key first");
    if (req.images.length) {
      const last = messages.at(-1);
      last.content = [
        { type: "text", text: last.content },
        ...req.images.map((url) => ({ type: "image_url", image_url: { url } })),
      ];
    }
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        response_format: { type: "json_object" },
      }),
      signal,
    });
    if (!r.ok) throw Error(`OpenAI ${r.status}: ${await r.text()}`);
    result = (await r.json()).choices[0].message.content;
  }
  onProgress?.({
    kind: "ai",
    stage: "Validating animation code",
    characters: result.length,
  });
  return (options?.schema ?? aiSchema).parse(
    JSON.parse(result.replace(/^```(?:json)?\s*|\s*```$/g, "")),
  ) as T;
}

async function geminiError(response: Response, key: string) {
  const raw = (await response.text()).split(key).join("[redacted]");
  let message = "Request rejected";
  try {
    message = JSON.parse(raw).error?.message ?? message;
  } catch {}
  return Error(
    `Gemini ${response.status}: ${message.slice(0, 1200)}${response.status === 429 ? " Check your Google AI Studio quota or choose another provider." : ""}`,
  );
}
export async function chatGPTError(response: Response, secret = "") {
  let raw = await response.text();
  if (secret) raw = raw.split(secret).join("[redacted]");
  raw = raw.replace(/Bearer\s+[^\s"<>]+/gi, "Bearer [redacted]");
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { detail: raw.slice(0, 1500) };
  }
  const error = data?.error ?? {},
    code = typeof error.code === "string" ? error.code : undefined,
    param = typeof error.param === "string" ? error.param : undefined;
  const message =
    typeof error.message === "string"
      ? error.message
      : typeof data?.detail === "string"
        ? data.detail
        : "The provider rejected the request.";
  const requestId = response.headers.get("x-request-id");
  let help = "";
  if (response.status === 400)
    help =
      "The request or selected model has an unsupported option. This is not evidence of a usage limit.";
  if (code === "subscription_sharing_usage_limit_exceeded")
    help =
      "An account or app usage limit was reached. Check ChatGPT Settings → Usage.";
  if (code === "subscription_sharing_user_not_eligible")
    help = "This account or workspace is not eligible for ChatGPT plan usage.";
  if (response.status === 503)
    help =
      "ChatGPT plan routing is temporarily unavailable. Keep the connection and try later.";
  return new Error(
    [
      `ChatGPT request failed (${response.status})`,
      code && `Code: ${code}`,
      param && `Parameter: ${param}`,
      message.slice(0, 1500),
      help,
      requestId && `Request ID: ${requestId}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export async function readChatGPTStream(
  response: Response,
  onProgress?: (progress: {
    kind: "ai";
    stage: string;
    characters: number;
  }) => void,
) {
  if (!response.body) throw Error("ChatGPT returned no response stream.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    text = "",
    completed = false;
  let lastReport = 0;
  onProgress?.({
    kind: "ai",
    stage: "Model is preparing a response",
    characters: 0,
  });
  const event = (block: string) => {
    const data = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;
    const e = JSON.parse(data);
    if (e.type === "response.output_text.delta") {
      text += e.delta;
      if (Date.now() - lastReport > 250) {
        lastReport = Date.now();
        onProgress?.({
          kind: "ai",
          stage: "Receiving animation code",
          characters: text.length,
        });
      }
    }
    if (["response.failed", "response.incomplete", "error"].includes(e.type)) {
      const code = e.response?.error?.code ?? e.error?.code ?? e.code ?? e.type;
      throw Error("ChatGPT generation did not complete: " + code);
    }
    if (e.type === "response.completed") {
      completed = true;
      if (!text)
        text = (e.response?.output ?? [])
          .flatMap((o: any) => o.content ?? [])
          .filter((c: any) => c.type === "output_text")
          .map((c: any) => c.text)
          .join("");
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(
        /\r\n/g,
        "\n",
      );
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        event(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
        if (completed) return text;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) event(buffer);
    if (!completed)
      throw Error(
        "ChatGPT stream ended before completion. No changes were applied.",
      );
    return text;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
