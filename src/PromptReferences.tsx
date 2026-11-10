import {
  promptReferencesSchema,
  type PromptReferences as References,
} from "../shared/prompt-references";

const fileKinds = {
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  webp: "webp",
  js: "code",
  css: "code",
  html: "code",
  json: "code",
  txt: "code",
} as const;

export function ContextFrame({
  value,
  onChange,
  busy,
  first,
  last,
}: {
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
  first: number;
  last: number;
}) {
  if (first > last) return null;
  return (
    <label className="field">
      Additional capture (source frame)
      <input
        type="number"
        value={value}
        min={first}
        max={last}
        step={1}
        placeholder="Optional"
        disabled={busy}
        onChange={(event) => onChange(event.target.value)}
      />
      <small>
        Choose a source frame from {first} to {last}.
      </small>
    </label>
  );
}

export function validContextFrame(
  frame: number | undefined,
  first: number,
  last: number,
) {
  return (
    frame === undefined ||
    (Number.isInteger(frame) && frame >= first && frame <= last)
  );
}

export function PromptReferences({
  references,
  busy,
  run,
  onChange,
}: {
  references: References;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
  onChange: (references: References) => void;
}) {
  return (
    <>
      <label className="field">
        Reference images and example code
        <input
          type="file"
          multiple
          accept={Object.keys(fileKinds)
            .map((extension) => "." + extension)
            .join(",")}
          disabled={busy}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (!files.length) return;
            void run(async () => {
              if (references.length + files.length > 6)
                throw Error("Choose at most six references.");
              const added: References = [];
              for (const file of files) {
                if (file.size > 2 * 1024 * 1024)
                  throw Error("Each reference must fit within 2 MB.");
                const extension =
                  file.name.split(".").pop()?.toLowerCase() ?? "";
                if (!Object.hasOwn(fileKinds, extension))
                  throw Error(
                    "Choose PNG, JPEG, WebP or a supported text code file.",
                  );
                const data = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onerror = () =>
                    reject(Error("Could not read " + file.name));
                  reader.onload = () =>
                    resolve(String(reader.result).split(",")[1]);
                  reader.readAsDataURL(file);
                });
                added.push({
                  name: file.name,
                  kind: fileKinds[extension as keyof typeof fileKinds],
                  data,
                });
              }
              const result = promptReferencesSchema.safeParse([
                ...references,
                ...added,
              ]);
              if (!result.success)
                throw Error(
                  "Choose nonempty files with names up to 200 characters and a total of 6 MB or less.",
                );
              onChange(result.data);
            });
          }}
        />
      </label>
      <p>
        Up to six references, 2 MB each and 6 MB total. Included as visual
        guidance or example code.
      </p>
      {references.length > 0 && (
        <ul>
          {references.map((reference, index) => (
            <li key={index}>
              {reference.name} ·{" "}
              {reference.kind === "code" ? "Example code" : "Visual reference"}
              <button
                disabled={busy}
                aria-label={"Remove reference " + reference.name}
                onClick={() =>
                  onChange(
                    references.filter((_, position) => position !== index),
                  )
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
