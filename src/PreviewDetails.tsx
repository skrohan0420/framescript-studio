import { create } from "zustand";
import { useStudio } from "./store";
import type { PreviewQuality } from "./preview-document";

export type PreviewDetails = {
  name: string; master: boolean; width: number; height: number; duration: number;
  quality: PreviewQuality; scale: number; displayWidth: number; displayHeight: number;
  magnification: number; fps: number; speed: number; loop: boolean; background: string;
  ready: boolean; updating: boolean; supported: boolean;
  sample: { fps: number; renderMs: number } | null;
};
// Transient preview telemetry: never persisted into project files or undo history.
export const usePreviewDetails = create<{ details: PreviewDetails | null }>(() => ({ details: null }));

export function CurrentPreviewDetails({ mode = "preview" }: { mode?: "preview" | "performance" }) {
  const details = usePreviewDetails(s => s.details);
  const playing = useStudio(s => s.playing);
  if (!details) return <section className="current-preview-details"><h3>Current preview</h3><p className="muted">Preview is not open.</p></section>;
  const d = details;
  const sample = playing && d.ready ? d.sample : null;
  const slow = sample !== null && sample.fps < d.fps * .9;
  const rows = [
    ["Viewing", d.name],
    ["Scope", d.master ? "Full composition" : "Selected timeline"],
    ["State", !d.ready ? "Loading preview" : d.updating ? "Updating preview" : playing ? "Playing" : "Paused"],
    ["Canvas", `${d.width} × ${d.height} px`],
    ["Duration", `${d.duration.toFixed(2)} s`],
    ["3D quality", { auto: "Auto · up to 1080p", "1080": "1080p", full: "Full resolution" }[d.quality]],
    ["3D render target", `${Math.round(d.width * d.scale)} × ${Math.round(d.height * d.scale)} px · ${Math.round(d.scale * 100)}%`],
    ["Display size", `${Math.round(d.displayWidth)} × ${Math.round(d.displayHeight)} CSS px`],
    ["Display scale", `${Math.round(d.magnification * 100)}% · fit × zoom`],
    ["Playback", `${d.speed}× speed · loop ${d.loop ? "on" : "off"}`],
    ["Background", d.background],
  ];
  return <section className="current-preview-details" aria-label={mode === "preview" ? "Current preview details" : "Current preview performance"}>
    {mode === "preview" ? <>
    <h3>Current preview</h3>
    <dl className="project-detail-list">{rows.slice(0, 5).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <h4>Rendering &amp; display</h4>
    <dl className="project-detail-list">{rows.slice(5).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <details className="preview-detail-help"><summary>How preview quality works</summary><p className="preview-detail-note">3D quality adjusts compatible Three.js rendering. HTML and 2D canvases retain their original resolution. Display size is the on-screen canvas size.</p></details>
    </> : <>
    <section className="preview-performance" aria-label="Preview performance" data-slow={slow}>
      <h3>FPS checker</h3>
      <p className="preview-performance-context">{d.name} · {d.master ? "Full composition" : "Selected timeline"}</p>
      <dl className="project-detail-list">
        <div><dt>Project target</dt><dd>Target {d.fps} FPS</dd></div>
        <div><dt>Frame budget</dt><dd>{(1000 / d.fps).toFixed(2)} ms/frame</dd></div>
        <div><dt>Measured FPS</dt><dd>{!d.supported ? "Unavailable for continuations" : !d.ready ? "Waiting for preview" : !playing ? "Preview paused" : sample === null ? "Measuring…" : `Live ${sample.fps.toFixed(1)} FPS`}</dd></div>
        <div><dt>Frame interval</dt><dd>{sample && d.supported && sample.fps > 0 ? `${(1000 / sample.fps).toFixed(2)} ms/frame` : "—"}</dd></div>
        <div><dt>Scene work</dt><dd>{sample && d.supported && sample.fps > 0 ? `${sample.renderMs.toFixed(2)} ms render` : "—"}</dd></div>
        <div><dt>Performance</dt><dd>{!d.supported ? "Not measured" : !d.ready ? "Loading preview" : !playing ? "Paused" : !sample ? "Sampling" : sample.fps === 0 ? "Waiting for frames" : slow ? "Below target" : "Meeting target"}</dd></div>
      </dl>
      <details className="preview-detail-help"><summary>What this measures</summary><p className="preview-detail-note">Completed scene updates, averaged over one second. Scene work measures synchronous rendering, not GPU completion or displayed pixels. Browser refresh rate can limit preview FPS. Export FPS is separate.</p></details>
    </section>
    </>}
  </section>;
}
