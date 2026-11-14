import type { PromptDraft } from "./prompt-templates";

export function directionSnapshot(draft: PromptDraft, context: unknown): string {
  const { directionApproval: _approval, ...inputs } = draft;
  const serialized = JSON.stringify({ inputs, context });
  // A compact change marker, not a security signature. Do not persist reference payloads twice.
  let first = 2166136261, second = 5381;
  for (let index = 0; index < serialized.length; index++) {
    first = Math.imul(first ^ serialized.charCodeAt(index), 16777619);
    second = Math.imul(second, 33) ^ serialized.charCodeAt(index);
  }
  return `${serialized.length}:${first >>> 0}:${second >>> 0}`;
}
