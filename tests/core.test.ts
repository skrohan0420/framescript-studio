import { describe, it, expect, beforeEach } from "vitest";
import {
  newProject,
  combined,
  parseCombined,
  applyAI,
  aiSchema,
  exportSchema,
  frameTimes,
} from "../shared/project";
import { documentFor } from "../shared/runtime";
import { useStudio } from "../src/store";
describe("source synchronization", () => {
  it("round trips a complete document including editable CSS and JS", () => {
    const p = newProject();
    expect(parseCombined(combined(p))).toEqual({
      html: p.html,
      css: p.css,
      js: p.js,
    });
    const edited = combined(p).replace('id="ball"', 'id="sphere"');
    expect(parseCombined(edited).html).toContain("sphere");
  });
  it("rejects external or module scripts without changing project source", () => {
    expect(() =>
      parseCombined('<script src="https://x.test/a.js"></script>'),
    ).toThrow();
    expect(() => parseCombined('<script type="module">x</script>')).toThrow();
  });
});
describe("AI validation and snapshots", () => {
  beforeEach(() => useStudio.getState().load(newProject()));
  it("accepts partial updates and preserves unrelated fields", () => {
    const p = newProject(),
      next = applyAI(p, {
        action: "update",
        css: "body{color:red}",
        explanation: "Recolor",
      });
    expect(next.html).toBe(p.html);
    expect(next.js).toBe(p.js);
    expect(next.css).toContain("red");
  });
  it("rejects malformed settings, unknown fields and assets", () => {
    expect(
      aiSchema.safeParse({ action: "delete", explanation: "x" }).success,
    ).toBe(false);
    expect(() =>
      applyAI(newProject(), {
        action: "update",
        settings: { fps: 0 },
        explanation: "bad",
      }),
    ).toThrow();
    expect(() =>
      applyAI(newProject(), {
        action: "update",
        assets: ["missing"],
        explanation: "bad",
      }),
    ).toThrow();
  });
  it("undoes and redoes an AI change as one operation", () => {
    const store = useStudio.getState();
    store.change(
      applyAI(store.project, {
        action: "update",
        html: "<h1>AI</h1>",
        css: "h1{color:blue}",
        explanation: "Updated",
      }),
      "AI update",
    );
    expect(useStudio.getState().project.html).toContain("AI");
    useStudio.getState().undo();
    expect(useStudio.getState().project.html).toBe(newProject().html);
    useStudio.getState().redo();
    expect(useStudio.getState().project.html).toContain("AI");
  });
});
describe("timing, settings and asset resolution", () => {
  it("maps output frame times to source time for faster and slower playback", () => {
    expect(frameTimes({ duration: 2, fps: 30, speed: 2 })).toHaveLength(30);
    expect(frameTimes({ duration: 2, fps: 30, speed: 0.5 })).toHaveLength(120);
    expect(frameTimes({ duration: 2, fps: 30, speed: 2 })[15]).toBe(1);
  });
  it("rejects H264 odd sizes and impossible transparency", () => {
    const o = {
      format: "mp4",
      width: 321,
      height: 180,
      fps: 30,
      duration: 2,
      speed: 1,
      quality: 20,
      fit: "fit",
      transparent: false,
    };
    expect(exportSchema.safeParse(o).success).toBe(false);
    expect(
      exportSchema.safeParse({ ...o, width: 320, transparent: true }).success,
    ).toBe(false);
  });
  it("resolves portable assets and installs a restrictive CSP", () => {
    const p = newProject();
    p.html = '<img src="asset://test">';
    p.assets = [
      { id: "test", name: "test.png", data: "data:image/png;base64,AAAA" },
    ];
    const html = documentFor(p);
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).not.toContain("asset://test");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("connect-src 'none'");
  });
});
