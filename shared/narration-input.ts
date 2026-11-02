/** Detect common timed-text formats without treating ordinary prose as captions. */
export function parseNarrationInput(input: string) {
  const time = String.raw`(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?`;
  const range = new RegExp(`^\\s*${time}\\s*-->\\s*${time}(?:\\s+.*)?$`);
  const stamped = new RegExp(`^\\s*(?:\\[(${time})\\]|(${time}))\\s+(.+)$`);
  const lines = input
    .replace(/^\uFEFF/, "")
    .replace(/^```(?:srt|vtt|text)?\s*$/gm, "")
    .split(/\r?\n/);
  const hasRanges = lines.some((line) => range.test(line));
  const hasStamps = lines.some((line) => stamped.test(line));
  if (!hasRanges && !hasStamps)
    return { script: input, timedNarration: "", format: "Plain text" };
  const text: string[] = [];
  let inCue = false,
    note = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^WEBVTT(?:\s|$)/.test(line)) continue;
    if (/^(NOTE|STYLE|REGION)(?:\s|$)/.test(line)) {
      note = true;
      continue;
    }
    if (!line) {
      inCue = false;
      note = false;
      continue;
    }
    if (note) continue;
    if (range.test(line)) {
      inCue = true;
      continue;
    }
    if (range.test(lines[i + 1] ?? "")) continue; // Cue number or VTT cue identifier.
    const stamp = line.match(stamped);
    if (stamp) text.push(stamp[3]);
    else if (inCue || !hasRanges) text.push(line.replace(/<[^>]*>/g, ""));
  }
  return {
    script: text.join(" ").trim(),
    timedNarration: input,
    format: /^\s*(?:\uFEFF)?WEBVTT/m.test(input)
      ? "VTT"
      : hasRanges
        ? "SRT"
        : "Timestamped text",
  };
}
