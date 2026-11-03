import { useState } from "react";
import type { PromptDraft } from "../shared/prompt-templates";
import { referenceStyles, editingStyles } from "../shared/prompt-templates";

const examples: Record<string, string> = {
  "Kurzgesagt-inspired":
    "A rounded planet, small geometric spacecraft and layered star field explain scale through a smooth zoom.",
  "Vox-inspired":
    "A modular map and highlighted evidence blocks reveal how two supplied facts connect.",
  "TED-Ed-inspired":
    "A symbolic character crosses a textured storybook setting as a concept unfolds.",
  "Veritasium-inspired":
    "Show a surprising apparatus result, inspect its mechanism, then reveal why it happened.",
  "3Blue1Brown-inspired":
    "Color-coded points transform into a curve while geometric relationships remain visible.",
  "Crash Course-inspired":
    "Bright diagram pieces assemble quickly, with playful visual metaphors and a readable final hold.",
  "The Economist-inspired":
    "A restrained chart isolates one supplied comparison with a single accent color.",
  "Documentary atlas":
    "Trace a supplied route, widen the map for context, then focus on the destination.",
  "Premium product film":
    "A sculptural product silhouette emerges from shadow; controlled highlights reveal its contours.",
  "Museum exhibit":
    "A carefully lit artifact rotates slowly while a nearby diagram reveals how it works.",
  "Retro educational film":
    "Warm geometric shapes demonstrate a mechanism with limited inks and subtle grain.",
  "Digital collage essay":
    "Paper-like fragments assemble into an original layered diagram around the subject.",
  "Natural history illustration":
    "A layered forest reveals a plant’s roots, trunk and canopy while surrounding wildlife establishes scale.",
  "Microscopic science":
    "A translucent cell opens into a simplified view of its internal structures as the narration introduces them.",
  "Space documentary":
    "Move from a planetary silhouette to a wider orbital diagram, holding a supplied scale comparison.",
  "Engineering cutaway":
    "A pump housing opens in section and fluid motion makes the impeller’s role clear.",
  "Architectural model":
    "A building’s outer shell lifts away to reveal room volumes and circulation paths.",
  "Whiteboard explanation":
    "Draw a simple mechanism progressively, then move one component to demonstrate the relationship.",
  "Paper sculpture":
    "Folded-paper mountains rise into place as layered clouds cross their shadows.",
  "Watercolor storybook":
    "Soft color washes establish a landscape before an original character enters along a clear path.",
  "Cel animation":
    "A clearly outlined character anticipates a jump, lands and settles through readable poses.",
  "Clay miniature":
    "A small rounded machine assembles on a matte tabletop and performs one purposeful action.",
  "Pixel-world illustration":
    "A tiny pixel city lights up block by block while a consistent-grid vehicle follows the road.",
  "Vintage travel poster":
    "Layered scenic silhouettes reveal a coastline and a small moving train with no added lettering.",
  "Comic-book diagram":
    "Panel-like compositions isolate setup, action and result using inked shapes and restrained halftone shading.",
  "Monochrome line study":
    "A few precise lines transform from a triangle into a geometric explanation, with one accent marking the change.",
  "Digital product interface":
    "Original interface panels rearrange to explain a supplied workflow without copying a real app.",
  "Neon technical display":
    "Luminous geometric paths show energy moving through a simplified system on a dark background.",
  "Measured explainer":
    "Establish the object → demonstrate one change → hold the result before moving on.",
  "Fast social edit":
    "Open on the strongest result → show concise supporting actions → land a short final hold.",
  "Documentary essay":
    "Wide context → evidence close-up → a wider composition explaining the consequence.",
  "Cinematic slow build":
    "A quiet opening gradually reveals more detail, reaches one key moment, then settles.",
  "Continuous one-shot":
    "Follow a droplet through connected stages without cutting away or losing its identity.",
  "Match-cut montage":
    "A circular planet becomes a similarly positioned wheel before the next action begins.",
  "Rhythmic montage":
    "A short accent, a longer reveal and a short response follow supplied music or narration cues.",
  "Question → reveal":
    "Show an unexpected outcome → reveal clues → demonstrate the answer → hold the takeaway.",
  "Step-by-step tutorial":
    "Show the starting state, complete one operation, pause, then continue to the next step.",
  "Before / after":
    "Keep framing fixed while the original state transforms into the improved result.",
  "Data story":
    "Establish a supplied baseline → add comparisons → isolate the largest meaningful difference.",
  "Playful motion":
    "A shape anticipates, moves with a small overshoot, then settles before the next action.",
  "Minimal luxury":
    "A long clean hold leads into a subtle lighting change and one precise feature reveal.",
  "Stop-motion feel":
    "A paper-like object advances through consistent stepped poses rather than smooth drifting.",
  "Loop-first":
    "Finish with the same composition and velocity as the opening so the motion repeats seamlessly.",
  "Split-screen comparison":
    "Both panels show the same stage together, then reveal a difference at the same moment.",
};

export function PromptDirectionStudio({
  kind,
  draft,
  update,
}: {
  kind: "reference" | "pacing";
  draft: PromptDraft;
  update: <K extends keyof PromptDraft>(key: K, value: PromptDraft[K]) => void;
}) {
  const reference = kind === "reference";
  const title = reference ? "Reference-inspired look" : "Editing & pacing";
  const key = reference ? "referenceStyle" : "editingStyle";
  const notesKey = reference ? "referenceNotes" : "editingNotes";
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const presets = reference ? referenceStyles : editingStyles;
  const groups: Record<string, readonly string[]> = reference
    ? {
        "Science & learning": [
          "Kurzgesagt-inspired",
          "TED-Ed-inspired",
          "Veritasium-inspired",
          "3Blue1Brown-inspired",
          "Crash Course-inspired",
          "Natural history illustration",
          "Microscopic science",
          "Space documentary",
          "Museum exhibit",
        ],
        Editorial: [
          "Vox-inspired",
          "The Economist-inspired",
          "Documentary atlas",
          "Digital collage essay",
          "Vintage travel poster",
          "Retro educational film",
        ],
        "Character & craft": [
          "Paper sculpture",
          "Watercolor storybook",
          "Cel animation",
          "Clay miniature",
          "Pixel-world illustration",
          "Comic-book diagram",
        ],
        "Product & technical": [
          "Premium product film",
          "Engineering cutaway",
          "Architectural model",
          "Whiteboard explanation",
          "Monochrome line study",
          "Digital product interface",
          "Neon technical display",
        ],
      }
    : {
        "Explain & compare": [
          "Measured explainer",
          "Documentary essay",
          "Question → reveal",
          "Step-by-step tutorial",
          "Before / after",
          "Data story",
          "Split-screen comparison",
        ],
        "High energy": [
          "Fast social edit",
          "Rhythmic montage",
          "Playful motion",
          "Stop-motion feel",
        ],
        "Calm & cinematic": ["Cinematic slow build", "Minimal luxury"],
        Continuous: ["Continuous one-shot", "Match-cut montage", "Loop-first"],
      };
  const selected = presets.find(
    ([name, direction]) => draft[key] === `${name}: ${direction}`,
  );
  const defaultName = reference
    ? "Original / no reference"
    : "Automatic / measured explainer";
  const filtered = presets.filter(
    ([name, direction]) =>
      (category === "All" || groups[category]?.includes(name)) &&
      `${name} ${direction} ${examples[name]}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className="direction-studio" aria-label={title}>
      <header>
        <span className="direction-eyebrow">
          {reference ? "VISUAL LANGUAGE" : "EDITORIAL DIRECTION"}
        </span>
        <h3>{title}</h3>
        <p>
          {reference
            ? "Choose how the artwork should feel: shapes, materials, palette and composition. This is inspiration for original artwork, not a request to copy a channel’s assets."
            : "Choose how the story unfolds: shot order, holds, cuts and transitions. Supplied narration timestamps always take priority over pacing preferences."}
        </p>
      </header>
      <div className="direction-current" aria-live="polite">
        <small>Selected direction</small>
        <strong>
          {selected?.[0] ?? (draft[key] ? "Custom direction" : defaultName)}
        </strong>
        <p>
          {selected?.[1] ||
            draft[key] ||
            (reference
              ? "Create an original visual treatment guided by your Visuals and Identity settings."
              : "Let each idea establish, demonstrate and settle at a readable pace.")}
        </p>
        {selected && (
          <>
            <h4>Example treatment</h4>
            <p>{examples[selected[0]]}</p>
          </>
        )}
        <small>
          Examples explain the treatment; they are not added as subjects or
          narration to your prompt.
        </small>
      </div>
      <label className="field">
        <span>
          {reference ? "Search reference looks" : "Search editing styles"}
        </span>
        <input
          type="search"
          aria-label={
            reference ? "Search reference looks" : "Search editing styles"
          }
          value={search}
          placeholder={
            reference
              ? "Try science, editorial, product…"
              : "Try calm, data, continuous…"
          }
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div
        className="direction-categories"
        role="group"
        aria-label={
          reference ? "Reference look categories" : "Editing style categories"
        }
      >
        {["All", ...Object.keys(groups)].map((value) => (
          <button
            key={value}
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {value}
            <small>
              {value === "All" ? presets.length : groups[value].length}
            </small>
          </button>
        ))}
      </div>
      <div className="direction-results">
        <span role="status">
          {filtered.length} of {presets.length} {reference ? "looks" : "styles"}
        </span>
        <span>Select a card to see its full direction and example.</span>
        {(search || category !== "All") && (
          <button
            onClick={() => {
              setSearch("");
              setCategory("All");
            }}
          >
            Reset filters
          </button>
        )}
      </div>
      <div
        className="direction-options"
        role="radiogroup"
        aria-label={
          reference ? "Reference look presets" : "Editing style presets"
        }
        onKeyDown={(event) => {
          if (
            ![
              "ArrowDown",
              "ArrowRight",
              "ArrowUp",
              "ArrowLeft",
              "Home",
              "End",
            ].includes(event.key)
          )
            return;
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              '[role="radio"]',
            ),
          );
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : (index +
                    (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) +
                    buttons.length) %
                  buttons.length;
          event.preventDefault();
          buttons[next]?.focus();
          buttons[next]?.click();
        }}
      >
        <button
          role="radio"
          tabIndex={
            !selected || !filtered.some(([name]) => name === selected[0])
              ? 0
              : -1
          }
          aria-checked={!draft[key]}
          onClick={() => update(key, "")}
        >
          <strong>{defaultName}</strong>
          <span>
            {reference
              ? "Use your own art direction without a named reference."
              : "Prioritize comprehension and adapt to your narration."}
          </span>
        </button>
        {filtered.map(([name, direction]) => (
          <button
            key={name}
            role="radio"
            tabIndex={draft[key] === `${name}: ${direction}` ? 0 : -1}
            aria-checked={draft[key] === `${name}: ${direction}`}
            onClick={() => update(key, `${name}: ${direction}`)}
          >
            <strong>
              {name}
              {draft[key] === `${name}: ${direction}` && (
                <span className="direction-selected-mark" aria-hidden="true">
                  Selected
                </span>
              )}
            </strong>
            <span className="direction-card-description">{direction}</span>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <p role="status">
          No matching presets. Try another search.{" "}
          <button
            onClick={() => {
              setSearch("");
              setCategory("All");
            }}
          >
            Clear search
          </button>
        </p>
      )}
      <div className="direction-tuning">
        <h4>Fine-tune this direction</h4>
        {reference ? (
          <label className="field">
            <span>Reference influence</span>
            <select
              aria-label="Reference influence"
              value={draft.referenceInfluence ?? "Balanced"}
              disabled={!draft.referenceStyle}
              onChange={(event) =>
                update("referenceInfluence", event.target.value)
              }
            >
              <option>Subtle</option>
              <option>Balanced</option>
              <option>Strong</option>
            </select>
            <small>
              Changes the emphasis on visual principles. Your mascot reference,
              exact text and supplied facts remain authoritative.
            </small>
          </label>
        ) : (
          <>
            <label className="field">
              <span>Pacing energy</span>
              <select
                aria-label="Pacing energy"
                value={draft.pacingEnergy ?? "Adapt to narration"}
                onChange={(event) => update("pacingEnergy", event.target.value)}
              >
                {[
                  "Adapt to narration",
                  "Calm / spacious",
                  "Balanced / readable",
                  "Energetic / concise",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Transition preference</span>
              <select
                aria-label="Transition preference"
                value={
                  draft.transitionPreference ?? "Follow selected editing style"
                }
                onChange={(event) =>
                  update("transitionPreference", event.target.value)
                }
              >
                {[
                  "Follow selected editing style",
                  "Hard cuts",
                  "Shape / position match cuts",
                  "Smooth morphs",
                  "Continuous movement / no cuts",
                  "Restrained fades",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <p className="type-control-help">
              When a transition preference conflicts with a preset, the explicit
              transition choice wins. No strobing or arbitrary fixed cut rate.
            </p>
          </>
        )}
        <label className="field">
          <span>
            {reference ? "Custom visual direction" : "Custom editing direction"}
          </span>
          <textarea
            aria-label={
              reference ? "Custom visual direction" : "Custom editing direction"
            }
            rows={3}
            maxLength={3000}
            value={draft[notesKey] ?? ""}
            placeholder={
              reference
                ? "What should be emphasized or avoided? e.g. Keep geometric shapes but use my muted palette."
                : "Describe the beat structure or holds you need. e.g. Hold the comparison until the narration explains it."
            }
            onChange={(event) => update(notesKey, event.target.value)}
          />
        </label>
        <p className="type-control-help">
          {reference
            ? "This section changes artwork direction. Editing & pacing controls rhythm separately."
            : "This section changes timing and structure. Reference look controls artwork separately."}{" "}
          These settings guide generated code; they do not change the current
          scene automatically.
        </p>
      </div>
    </section>
  );
}
