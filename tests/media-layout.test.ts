import { expect, it } from "vitest";
import { imageMarkup, sizeError } from "../shared/media-layout";
it("accepts landscape/portrait 4K and rejects invalid export dimensions", () => {
  expect(sizeError({ width: 3840, height: 2160 }, true)).toBe("");
  expect(sizeError({ width: 2160, height: 3840 }, true)).toBe("");
  expect(sizeError({ width: 4096, height: 2160 }, true)).toContain("4K");
  expect(sizeError({ width: 1921, height: 1080 }, true)).toContain("even");
  expect(sizeError({ width: 0, height: 1080 })).not.toBe("");
});
it("inserts frame-sized images at the origin and centers smaller custom images", () => {
  const frame = { width: 1920, height: 1080 };
  const full = imageMarkup("asset-1", frame, { ...frame, fit: "contain" });
  expect(full).toContain(
    "left:0px;top:0px;width:1920px;height:1080px;object-fit:contain",
  );
  expect(
    imageMarkup("asset-1", frame, { width: 640, height: 360, fit: "cover" }),
  ).toContain("left:640px;top:360px;width:640px;height:360px;object-fit:cover");
  expect(imageMarkup("asset-1", frame, { ...frame, fit: "contain" })).not.toBe(
    full,
  );
});
