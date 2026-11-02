import { expect, it } from "vitest";
import { editTextTiming } from "../shared/text-timing";
import { textLayerSchema, textTemplates } from "../shared/typography";
const layer = textLayerSchema.parse({
  id: "text",
  text: "Timing",
  template: textTemplates[0],
  x: 50,
  y: 50,
  width: 80,
  size: 60,
  color: "white",
  font: "Arial",
  align: "center",
  start: 2,
  end: 5,
  entrance: 1,
});
it("moves and trims text within its scene without reversing the interval", () => {
  expect(editTextTiming(layer, -10, "move", 0, 10)).toMatchObject({
    start: 0,
    end: 3,
  });
  expect(editTextTiming(layer, 10, "move", 0, 10)).toMatchObject({
    start: 7,
    end: 10,
  });
  expect(editTextTiming(layer, 10, "start", 0, 10)).toMatchObject({
    start: 4.9,
    end: 5,
  });
  expect(editTextTiming(layer, -10, "end", 0, 10)).toMatchObject({
    start: 2,
    end: 2.1,
  });
});
it("uses the visible portion and original clock of a split scene", () => {
  expect(editTextTiming(layer, 0, "move", 3, 3)).toMatchObject({
    start: 3,
    end: 5,
  });
  expect(editTextTiming(layer, 2, "move", 3, 3)).toMatchObject({
    start: 4,
    end: 6,
  });
});
