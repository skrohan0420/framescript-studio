import { z } from "zod";
import type { ServiceId, ServiceCheck } from "../shared/services";
import { serviceIds } from "../shared/services";
import { elevenSubscription, elevenCatalog, googleImageModels } from "./media";
import { models } from "./ai";
export const serviceIdSchema = z.enum(serviceIds);
export async function checkService(
  id: ServiceId,
  key?: string,
): Promise<ServiceCheck> {
  const checkedAt = new Date().toISOString();
  try {
    if (id === "flow")
      throw Error(
        "Flow is an external handoff. Check account access and credits in Flow.",
      );
    if (id !== "ollama" && !key)
      throw Error(
        id === "chatgpt"
          ? "Continue with ChatGPT to connect your account."
          : "Add an API key in Services first.",
      );
    if (id === "eleven") {
      const [catalog, subscription] = await Promise.allSettled([
        elevenCatalog(key!),
        elevenSubscription(key!),
      ]);
      if (catalog.status === "rejected") throw catalog.reason;
      if (!catalog.value.voices.length)
        throw Error(
          "ElevenLabs is reachable, but no voices are available. Add a voice or check voice-read permissions.",
        );
      if (!catalog.value.models.length)
        throw Error(
          "ElevenLabs is reachable, but no speech models are available for this account.",
        );
      return {
        state: "ready",
        checkedAt,
        message: `Voice catalog reachable · ${catalog.value.voices.length} voices available. Generation has not been tested by this check.`,
        ...(subscription.status === "fulfilled"
          ? { quota: subscription.value }
          : {
              quotaError:
                "Usage unavailable. Allow subscription read access on this API key, then refresh.",
            }),
      };
    }
    const list =
      id === "gemini"
        ? await models(
            { provider: "gemini", model: "", key },
            AbortSignal.timeout(15000),
          )
        : await models(
            { provider: id as "chatgpt" | "openai" | "ollama", model: "", key },
            AbortSignal.timeout(15000),
          );
    if (!list.length)
      throw Error(
        id === "ollama"
          ? "Ollama is running, but no local models are installed. Pull a model, then check again."
          : "Connected, but no compatible models are available. Check account access.",
      );
    return {
      state: "ready",
      checkedAt,
      message: `Model catalog reachable · ${list.length} models available. Generation has not been tested by this check.`,
    };
  } catch (error) {
    let message = (error as Error).message;
    if (id === "ollama" && /fetch failed|abort|timeout/i.test(message))
      message =
        "Ollama is unreachable at 127.0.0.1:11434. Start Ollama and check again.";
    if (key) message = message.split(key).join("[redacted]");
    return { state: "error", checkedAt, message: message.slice(0, 1500) };
  }
}
