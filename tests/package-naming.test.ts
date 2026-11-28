import { expect, it } from "vitest";
import { packageFilename, projectPackageContext, type PackageContext } from "../shared/package-naming";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";

const context: PackageContext = { projectName: "Whatever", sceneTitle: "Star formation", sceneNumber: 1, renderingMode: "3d", timeZone: "Asia/Kolkata" };
const time = new Date("2026-11-28T13:51:05.123Z");

it("groups project and scene with distinct director and implementation categories in local time", () => {
  expect(packageFilename(context, "director", time)).toBe("01 Director - Whatever - Scene 01 Star formation - 3D - 2026-11-28_192105-123.zip");
  expect(packageFilename(context, "code", time)).toBe("02 Scene Code - Whatever - Scene 01 Star formation - 3D - 2026-11-28_192105-123.zip");
  expect(packageFilename(context, "code", new Date(time.getTime() + 1))).not.toBe(packageFilename(context, "code", time));
});
it("distinguishes continuation numbers and native scene operations", () => {
  expect(packageFilename({ ...context, continuationNumber: 2 }, "continuation-director", time)).toMatch(/^01 Director - .* - Continuation 02 - /);
  expect(packageFilename({ ...context, continuationNumber: 2 }, "continuation-code", time)).toMatch(/^02 Scene Code - .* - Continuation 02 - /);
  for (const [purpose, label] of [["native-scene", "03 Editable Scene"], ["native-extend", "04 Editable Extension"], ["native-edit", "05 Editable Edit"]] as const) {
    expect(packageFilename(context, purpose, time).startsWith(label + " - ")).toBe(true);
    expect(packageFilename(context, purpose, time)).not.toContain(" - 3D - ");
  }
});
it("keeps names bounded and Windows-safe while preserving Unicode and handling invalid timezones", () => {
  const name = packageFilename({ ...context, projectName: 'A/<bad>:"film"?*\\\r\n café', sceneTitle: "🌞".repeat(100), timeZone: "invalid zone" }, "code", time);
  expect(name).toContain("café");
  expect(name).not.toMatch(/[<>:"/\\|?*\x00-\x1f]/);
  expect([...name].length).toBeLessThan(210);
  expect(() => encodeURIComponent(name)).not.toThrow();
  expect(name).toContain("2026-11-28_135105-123.zip");
  expect(packageFilename({ ...context, projectName: "...", sceneTitle: "" }, "director", time)).toContain("Untitled project - Scene 01 Untitled scene");
});
it("uses the requested scene's identity rather than the currently selected one", () => {
  const p = newProject();
  p.workflow = initialWorkflow(p);
  p.workflow.scenes.push({ ...p.workflow.scenes[0], id: "second", title: "Core collapse" });
  expect(projectPackageContext(p, "second")).toMatchObject({ projectName: p.name, sceneNumber: 2, sceneTitle: "Core collapse" });
  expect(projectPackageContext(newProject())).toMatchObject({ sceneNumber: 1, sceneTitle: "Untitled animation" });
});
