import { expect, it } from "vitest";
import {
  readTextLayers,
  writeTextLayer,
  textLayerSchema,
  textTemplates,
} from "../shared/typography";
const layer = textLayerSchema.parse({
  id: "text-one",
  text: '<script>alert("x")</script> & hello',
  template: textTemplates[0],
  x: 50,
  y: 80,
  width: 90,
  size: 64,
  color: "#fff",
  font: "Arial",
  align: "center",
  start: 1,
  end: 4,
  entrance: 0.8,
});
it("round trips text safely and updates or removes a single layer without duplicating it", () => {
  const original = '<div id="scene">Scene content</div>';
  const html = writeTextLayer(original, layer);
  expect(new DOMParser().parseFromString(html, "text/html").querySelector("script")).toBeNull();
  expect(readTextLayers(html)).toEqual([layer]);
  const edited = writeTextLayer(html, { ...layer, text: "New words", x: 25 });
  expect(readTextLayers(edited)).toEqual([
    { ...layer, text: "New words", x: 25 },
  ]);
  expect(writeTextLayer(edited, layer, true)).toBe(original);
});
it("provides validated presets and ignores malformed user-edited metadata", () => {
  expect(textTemplates).toHaveLength(48);
  expect(new Set(textTemplates.map((item) => item.id)).size).toBe(48);
  expect(readTextLayers('<div data-fs-text="broken"></div>')).toEqual([]);
  expect(textLayerSchema.safeParse({ ...layer, size: -1 }).success).toBe(false);
});
