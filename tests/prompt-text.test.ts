import { expect, it } from "vitest";
import { buildCodePrompt, type PromptDraft } from "../shared/prompt-templates";
import { promptTextSchema, textKinds } from "../shared/prompt-text";

const draft: PromptDraft = {
  template: "canvas",
  script: "Narration",
  duration: 10,
  style: "",
  visuals: "",
  camera: "",
  screenText: "",
  notes: "",
  format: "document",
};
it("excludes all saved typography settings unless explicitly enabled", () => {
  const saved = {
    ...draft,
    screenText: "STALE TITLE",
    subtitles: "Phrase subtitles",
    textFont: "Georgia",
    textItems: [
      promptTextSchema.parse({
        id: "counter",
        kind: "Number counter",
        prefix: "OLD PREFIX",
      }),
    ],
  };
  for (const typographyEnabled of [false, undefined]) {
    const prompt = buildCodePrompt({ ...saved, typographyEnabled }, 1920, 1080);
    for (const value of [
      "STALE TITLE",
      "TYPOGRAPHY & SUBTITLES",
      "Font treatment:",
      "Title / label font size",
      "OLD PREFIX",
      "Georgia",
    ])
      expect(prompt).not.toContain(value);
    expect(prompt).toContain("Do not add any text");
  }
});
it("does not add a style specification when text is enabled but no content is requested", () => {
  expect(
    buildCodePrompt({ ...draft, typographyEnabled: true }, 1920, 1080),
  ).not.toContain("TYPOGRAPHY & SUBTITLES");
});
it("includes independent label and counter settings and omits disabled items", () => {
  const label = promptTextSchema.parse({
    id: "label",
    kind: "Subject label",
    text: "Mars",
    subject: "The red planet",
    font: "Georgia",
    size: 42,
    start: 1,
    end: 6,
    x: 70,
    y: 20,
  });
  const counter = promptTextSchema.parse({
    id: "counter",
    kind: "Number counter",
    from: 0,
    to: 1250,
    decimals: 2,
    prefix: "$",
    suffix: " million",
    start: 2,
    end: 9,
    color: "#ffcc00",
  });
  const prompt = buildCodePrompt(
    {
      ...draft,
      typographyEnabled: true,
      textItems: [
        label,
        counter,
        { ...label, id: "off", enabled: false, text: "DO NOT INCLUDE" },
      ],
    },
    1920,
    1080,
  );
  for (const value of [
    "Mars",
    "The red planet",
    "Georgia",
    '"size": 42',
    '"to": 1250',
    '"decimals": 2',
    "$",
    " million",
    "#ffcc00",
    "renderFrame(time)",
  ])
    expect(prompt).toContain(value);
  expect(prompt).not.toContain("DO NOT INCLUDE");
});
it("validates timing, subject labels and missing text, with counters/captions explicitly supported", () => {
  const build = (item: unknown) =>
    buildCodePrompt(
      {
        ...draft,
        typographyEnabled: true,
        textItems: [promptTextSchema.parse(item)],
      },
      1920,
      1080,
    );
  expect(() =>
    build({ id: "a", kind: "Title", text: "Hello", start: 5, end: 3 }),
  ).toThrow("start/end");
  expect(() =>
    build({ id: "a", kind: "Title", text: "Hello", end: 11 }),
  ).toThrow("start/end");
  expect(() =>
    build({ id: "a", kind: "Subject label", text: "Hello" }),
  ).toThrow("describe the subject");
  expect(() => build({ id: "a", kind: "Title" })).toThrow("exact text");
  for (const kind of textKinds)
    expect(() =>
      build({ id: kind, kind, text: "Exact copy", subject: "The subject" }),
    ).not.toThrow();
});
