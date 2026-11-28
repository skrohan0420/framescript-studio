// @vitest-environment node
import { it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { StudioDatabase } from "../server/database";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";
it("renames current workspace and saved project atomically without replacing workspace edits", async () => {
  const dir = path.resolve("test-results/db-rename-" + randomUUID());
  let db = await StudioDatabase.open(dir);
  const p = newProject();
  db.putProject("current.frame", p);
  db.set("currentProject", "current.frame");
  db.saveWorkspace({ ...p, html: "<h1>Unsaved workspace edit</h1>" });
  db.renameProject("current.frame", "Renamed");
  db.close();
  db = await StudioDatabase.open(dir);
  expect(db.project("current.frame").name).toBe("Renamed");
  expect(db.workspace()?.name).toBe("Renamed");
  expect(db.workspace()?.html).toContain("Unsaved workspace edit");
  db.close();
});
it("retains library-only recordings after timeline deletion and database restart", async () => {
  const dir = path.resolve("test-results/db-audio-library-" + randomUUID());
  const source = clipFromAudio(synthesizeSound("Success chime"), "voice");
  const project = { ...newProject(), audio: [], audioLibrary: [source] };
  let db = await StudioDatabase.open(dir);
  db.saveWorkspace(project);
  db.close();
  db = await StudioDatabase.open(dir);
  expect(db.workspace()).toEqual(project);
  expect(fs.readdirSync(path.join(dir, "media")).length).toBe(1);
  db.close();
});
it("skips malformed legacy projects without losing valid migrations or originals", async () => {
  const dir = path.resolve("test-results/db-legacy-invalid-" + randomUUID());
  fs.mkdirSync(path.join(dir, "projects"), { recursive: true });
  fs.writeFileSync(path.join(dir, "projects", "a-invalid.frame"), "{}");
  fs.writeFileSync(
    path.join(dir, "projects", "b-valid.frame"),
    JSON.stringify(newProject()),
  );
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const db = await StudioDatabase.open(dir);
    expect(db.recents()).toEqual(["b-valid.frame"]);
    expect(db.project("b-valid.frame")).toEqual(newProject());
    expect(
      fs.readFileSync(path.join(dir, "projects", "a-invalid.frame"), "utf8"),
    ).toBe("{}");
    expect(warning).toHaveBeenCalled();
    db.close();
  } finally {
    warning.mockRestore();
  }
});
it("retains bounded recovery versions after replacement and reopening", async () => {
  const dir = path.resolve("test-results/db-history-" + randomUUID());
  let db = await StudioDatabase.open(dir);
  const p = newProject();
  p.assets = [
    { id: "ref", name: "ref.png", data: "data:image/png;base64,AQID" },
  ];
  db.saveWorkspace(p, {
    sceneChats: { project: [{ role: "user", content: "Keep this" }] },
  });
  const id = db.checkpoint("Before replacement")!;
  db.saveWorkspace({ ...newProject(), name: "New workspace" }, {});
  db.close();
  db = await StudioDatabase.open(dir);
  expect(db.recoveryProject(id).project).toEqual(p);
  expect(db.recoveryProject(id).editor.sceneChats.project[0].content).toBe(
    "Keep this",
  );
  for (let i = 0; i < 25; i++) db.checkpoint("Version " + i);
  expect(db.recoveryList()).toHaveLength(20);
  expect(db.recoveryList()[0].reason).toBe("Version 24");
  db.close();
});
it("rolls back workspace and editor state together when disk persistence fails", async () => {
  const dir = path.resolve("test-results/db-failure-" + randomUUID());
  const db = await StudioDatabase.open(dir);
  const p = newProject();
  db.saveWorkspace(p, { sceneChats: {} });
  const rename = vi.spyOn(fs, "renameSync").mockImplementationOnce(() => {
    throw Error("disk full");
  });
  try {
    expect(() =>
      db.saveWorkspace(
        { ...p, name: "Not saved" },
        { sceneChats: { project: [] } },
      ),
    ).toThrow("disk full");
    expect(db.workspace()?.name).toBe(p.name);
    expect(db.get("workspaceEditor")).toEqual({ sceneChats: {} });
  } finally {
    rename.mockRestore();
    db.close();
  }
});
it("preserves a corrupt database and restores a validated startup backup", async () => {
  const dir = path.resolve("test-results/db-corrupt-" + randomUUID());
  let db = await StudioDatabase.open(dir);
  const p = { ...newProject(), name: "Known good" };
  db.saveWorkspace(p);
  db.close();
  db = await StudioDatabase.open(dir);
  db.close();
  fs.writeFileSync(path.join(dir, "studio.db"), "corrupt");
  db = await StudioDatabase.open(dir);
  expect(db.workspace()).toEqual(p);
  expect(
    fs.readdirSync(dir).some((name) => name.startsWith("studio.db.corrupt-")),
  ).toBe(true);
  db.close();
});
it("refreshes the recovery copy during a session and recovers it after corruption", async () => {
  const dir = path.resolve("test-results/db-session-backup-" + randomUUID());
  const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  let db = await StudioDatabase.open(dir);
  try {
    const p = { ...newProject(), name: "Recent work" };
    db.saveWorkspace(p);
    now.mockReturnValue(1_060_001);
    db.saveWorkspace({ ...p, name: "Latest work" });
    db.close();
    fs.writeFileSync(path.join(dir, "studio.db"), "broken save");
    db = await StudioDatabase.open(dir);
    expect(db.workspace()).toEqual(p);
    expect(fs.readdirSync(dir).some((name) => name.startsWith("studio.db.corrupt-"))).toBe(true);
  } finally {
    now.mockRestore();
    db.close();
  }
});
it("falls back to startup recovery when the rolling backup is also damaged", async () => {
  const dir = path.resolve("test-results/db-double-corruption-" + randomUUID());
  let db = await StudioDatabase.open(dir);
  const p = { ...newProject(), name: "Startup recovery" };
  db.saveWorkspace(p);
  db.close();
  db = await StudioDatabase.open(dir);
  db.close();
  fs.writeFileSync(path.join(dir, "studio.db"), "damaged");
  fs.writeFileSync(path.join(dir, "studio.db.save-backup"), "damaged backup");
  db = await StudioDatabase.open(dir);
  expect(db.workspace()).toEqual(p);
  db.close();
});
it("rejects damaged media instead of silently loading altered bytes", async () => {
  const dir = path.resolve("test-results/db-media-integrity-" + randomUUID());
  const db = await StudioDatabase.open(dir);
  try {
    const p = newProject();
    p.assets = [{ id: "image", name: "image.png", data: "data:image/png;base64,AQID" }];
    db.saveWorkspace(p);
    expect(db.workspace()).toEqual(p);
    const [filename] = fs.readdirSync(path.join(dir, "media"));
    fs.writeFileSync(path.join(dir, "media", filename), "damaged image");
    expect(() => db.workspace()).toThrow("integrity check");
  } finally {
    db.close();
  }
});
it("keeps independent continuation versions recoverable across edits and restart", async () => {
  const dir = path.resolve("test-results/db-continuation-history-" + randomUUID());
  let db = await StudioDatabase.open(dir);
  const p = newProject();
  p.workflow = initialWorkflow(p);
  p.workflow.scenes[0].visualDuration = 2;
  p.workflow.scenes[0].visualContinuations = [{
    id: randomUUID(), start: 2, duration: 2,
    html: "<div>Saved continuation</div>", css: "", js: "",
  }];
  const original = structuredClone(p.workflow.scenes[0].visualContinuations[0]);
  const scope = `continuation/${original.id}`;
  db.putProject("safe.frame", p);
  p.workflow.scenes[0].visualContinuations[0].html = "<div>Replacement</div>";
  db.saveWorkspace(p, undefined, "safe.frame");
  db.close();
  db = await StudioDatabase.open(dir);
  const versions = db.codeHistory("safe.frame", scope);
  expect(versions).toHaveLength(2);
  expect(db.codeVersion("safe.frame", scope, versions[1].id).html).toBe(original.html);
  expect(db.codeVersion("safe.frame", scope, versions[0].id).html).toContain("Replacement");
  expect(db.codeHistory("safe.frame", "scene-1")).toHaveLength(1);
  db.close();
});
it("persists workspace, independent scenes, media, preferences and history across a database reopen", async () => {
  const dir = path.resolve("test-results/db-" + randomUUID());
  let db = await StudioDatabase.open(dir);
  const p = newProject();
  p.workflow = initialWorkflow(p);
  p.assets = [
    { id: "image", name: "image.png", data: "data:image/png;base64,AQID" },
  ];
  p.audio = [clipFromAudio(synthesizeSound("Soft pop"), "sfx")];
  db.saveWorkspace(p);
  db.putProject("test.frame", p);
  db.set("settings", {
    theme: "light",
    mediaPreferences: { voice: "saved-voice" },
  });
  db.set("workspaceEditor", {
    sceneChats: { "scene-1": [{ role: "user", content: "saved message" }] },
  });
  db.close();
  db = await StudioDatabase.open(dir);
  expect(db.workspace()).toEqual(p);
  expect(db.project("test.frame")).toEqual(p);
  expect(db.get("settings").mediaPreferences.voice).toBe("saved-voice");
  expect(db.get("workspaceEditor").sceneChats["scene-1"][0].content).toBe(
    "saved message",
  );
  expect(
    fs.readFileSync(path.join(dir, "studio.db")).subarray(0, 15).toString(),
  ).toBe("SQLite format 3");
  expect(fs.readdirSync(path.join(dir, "media"))).toHaveLength(2);
  db.trash("test.frame");
  db.close();
  db = await StudioDatabase.open(dir);
  expect(db.recents()).toEqual([]);
  db.close();
});
it("migrates legacy projects, recovery and settings once without modifying originals", async () => {
  const dir = path.resolve("test-results/db-" + randomUUID());
  fs.mkdirSync(path.join(dir, "projects"), { recursive: true });
  const p = newProject();
  fs.writeFileSync(
    path.join(dir, "projects", "legacy.frame"),
    JSON.stringify(p),
  );
  fs.writeFileSync(path.join(dir, "recovery.frame"), JSON.stringify(p));
  fs.writeFileSync(
    path.join(dir, "settings.json"),
    JSON.stringify({ fontSize: 19 }),
  );
  let db = await StudioDatabase.open(dir);
  expect(db.workspace()).toEqual(p);
  expect(db.recents()).toEqual(["legacy.frame"]);
  expect(db.get("settings").fontSize).toBe(19);
  db.trash("legacy.frame");
  db.close();
  db = await StudioDatabase.open(dir);
  expect(db.recents()).toEqual([]);
  expect(fs.existsSync(path.join(dir, "projects", "legacy.frame"))).toBe(true);
  db.close();
});
