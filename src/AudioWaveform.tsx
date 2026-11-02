import { memo, useEffect, useRef, useState } from "react";
import type { AudioClip } from "../shared/project";
import { audioDetails } from "./audio";
import { waveformColumns } from "../shared/waveform-view";

const cache = new Map<string, Promise<number[]>>();
export const AudioWaveform = memo(function AudioWaveform({
  clip,
  thumbnail = false,
}: {
  clip: AudioClip;
  thumbnail?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [decoded, setDecoded] = useState<number[]>();
  useEffect(() => {
    setDecoded(undefined);
    let alive = true;
    let pending = cache.get(clip.data);
    if (!pending) {
      if (cache.size >= 24) cache.delete(cache.keys().next().value!);
      pending = audioDetails(clip.data, 16384).then((details) => details.peaks);
      cache.set(clip.data, pending);
    }
    pending
      .then((peaks) => {
        if (alive) setDecoded(peaks);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [clip.data, clip.peaks]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const peaks = decoded ?? clip.peaks ?? [];
    const maximum = Math.max(0.01, ...peaks);
    const draw = () => {
      const { width, height } = element.getBoundingClientRect();
      const scale = Math.min(2, window.devicePixelRatio || 1);
      element.width = Math.max(1, Math.round(width * scale));
      element.height = Math.max(1, Math.round(height * scale));
      const context = element.getContext("2d");
      if (!context) return;
      context.scale(scale, scale);
      context.fillStyle =
        getComputedStyle(element).getPropertyValue("--wave").trim() ||
        "#37b5e7";
      const bars = waveformColumns(
        peaks,
        clip.duration,
        thumbnail ? 0 : clip.trimIn,
        thumbnail ? clip.duration : clip.length,
        Math.ceil(width / 2),
        thumbnail ? false : clip.loop,
      );
      for (let index = 0; index < bars.length; index++) {
        const x = index * 2,
          amplitude = bars[index];
        const bar = Math.max(1, (amplitude / maximum) * (height - 1));
        context.fillRect(
          x,
          thumbnail ? (height - bar) / 2 : height - bar,
          1,
          bar,
        );
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    const themeObserver = new MutationObserver(draw);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    draw();
    return () => {
      observer.disconnect();
      themeObserver.disconnect();
    };
  }, [
    clip.trimIn,
    clip.length,
    clip.duration,
    clip.loop,
    clip.peaks,
    decoded,
    thumbnail,
  ]);
  return (
    <canvas
      ref={canvas}
      className={
        thumbnail
          ? "library-waveform audio-waveform-thumbnail"
          : "audio-peaks audio-waveform"
      }
      aria-hidden="true"
    />
  );
});
