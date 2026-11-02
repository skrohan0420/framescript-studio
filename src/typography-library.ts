import { textTemplateSchema, type TextTemplate } from "../shared/typography";
const key = "framescript.typography-library.v1";
export function savedTextTemplates(): TextTemplate[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed)
      ? parsed
          .flatMap((item) => {
            const result = textTemplateSchema.safeParse(item);
            return result.success ? [result.data] : [];
          })
          .slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
export function saveTextTemplates(values: unknown[]) {
  const saved = savedTextTemplates();
  const fingerprint = (item: TextTemplate) =>
    JSON.stringify([
      item.font,
      item.weight,
      item.color,
      item.frames,
      item.appearance,
      item.easing,
    ]);
  let changed = false;
  const known = new Set(saved.map(fingerprint));
  for (const value of values.slice(0, 40)) {
    const result = textTemplateSchema.safeParse({
      ...(value as object),
      id: crypto.randomUUID(),
      category: "Saved",
    });
    if (!result.success || known.has(fingerprint(result.data))) continue;
    known.add(fingerprint(result.data));
    changed = true;
    saved.unshift(result.data);
  }
  if (!changed) return;
  try {
    localStorage.setItem(key, JSON.stringify(saved.slice(0, 100)));
    window.dispatchEvent(new Event("typography-library-change"));
  } catch {
    /* Keep the editor usable if browser storage is full. */
  }
}
export function deleteTextTemplate(id: string) {
  localStorage.setItem(
    key,
    JSON.stringify(savedTextTemplates().filter((item) => item.id !== id)),
  );
  window.dispatchEvent(new Event("typography-library-change"));
}
