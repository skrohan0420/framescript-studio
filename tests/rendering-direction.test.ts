import { expect, it } from "vitest";
import { reference3DArtDirection } from "../shared/rendering-direction";

it("adapts only the selected reference and leaves explicit influence choices intact", () => {
  const subtle = reference3DArtDirection({ renderingMode: "3d", referenceStyle: "Kurzgesagt-inspired", referenceInfluence: "Subtle" });
  expect(subtle).toContain("Reference influence: Subtle");
  expect(subtle).toContain("subtle influence uses selected accents");
  const other = reference3DArtDirection({ renderingMode: "3d", referenceStyle: "Paper sculpture" });
  expect(other).toContain("REFERENCE-LED 3D ART DIRECTION");
  expect(other).not.toContain("KURZGESAGT");
  expect(reference3DArtDirection({ renderingMode: "2d", referenceStyle: "Kurzgesagt-inspired" })).toBe("");
  expect(reference3DArtDirection({ renderingMode: "3d" })).toBe("");
});
