// Aggregate every source bin covered by a screen column; never point-sample
// a reduced waveform, which can discard short transients between columns.
export function waveformColumns(
  peaks: number[],
  sourceDuration: number,
  start: number,
  length: number,
  columns: number,
  loop = false,
) {
  const count = Math.max(1, Math.floor(columns));
  const rangePeak = (from: number, to: number) => {
    if (
      sourceDuration <= 0 ||
      !peaks.length ||
      to <= 0 ||
      from >= sourceDuration
    )
      return 0;
    const first = Math.max(
      0,
      Math.floor((from / sourceDuration) * peaks.length),
    );
    const last = Math.min(
      peaks.length,
      Math.ceil((to / sourceDuration) * peaks.length),
    );
    let peak = 0;
    for (let i = first; i < last; i++) peak = Math.max(peak, peaks[i]);
    return peak;
  };
  return Array.from({ length: count }, (_, index) => {
    const from = start + (index / count) * length;
    const to = start + ((index + 1) / count) * length;
    if (!loop || sourceDuration <= 0) return rangePeak(from, to);
    if (to - from >= sourceDuration) return rangePeak(0, sourceDuration);
    const wrapped = ((from % sourceDuration) + sourceDuration) % sourceDuration;
    const end = wrapped + to - from;
    return end <= sourceDuration
      ? rangePeak(wrapped, end)
      : Math.max(
          rangePeak(wrapped, sourceDuration),
          rangePeak(0, end - sourceDuration),
        );
  });
}
