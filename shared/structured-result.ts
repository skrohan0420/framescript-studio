import type { z } from "zod";

export const structuredResultModuleInstructions =
  "Return one JavaScript module containing only `export default` followed by a strict JSON object and an optional semicolon. Send it as a .mjs file or one JavaScript code block without surrounding prose. Do not add imports, functions, expressions, or comments. FrameScript reads the data without executing the module.";

export function parseStructuredResult<T>(
  text: string,
  schema: z.ZodType<T>,
  name: string,
) {
  const trimmed = text.trim();
  const fenced = /^```(json|js|javascript|mjs)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(
    trimmed,
  );
  const source = (fenced?.[2] ?? trimmed).trim();
  const legacyOnly = fenced?.[1]?.toLowerCase() === "json";
  const exported = legacyOnly
    ? null
    : /^export\s+default\s+(\{[\s\S]*\})\s*;?$/.exec(source);

  let value: unknown;
  try {
    value = JSON.parse(exported?.[1] ?? source);
  } catch {
    throw Error(
      `Paste or upload a module containing only export default followed by a JSON object, or one JSON ${name}.`,
    );
  }
  const result = schema.safeParse(value);
  if (!result.success)
    throw Error(
      result.error.issues
        .map((issue) => `${issue.path.join(".") || "Result"}: ${issue.message}`)
        .join("\n"),
    );
  return result.data;
}
