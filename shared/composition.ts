import type { Project } from "./project";
import { documentFor } from "./runtime";
import { sceneOffset, totalDuration } from "./workflow";
export const compositionCss =
  "body{margin:0;position:relative}iframe{position:absolute;inset:0;width:100%;height:100%;border:0;visibility:hidden}";
export function compositionScript(
  offsets: { start: number; duration: number }[],
) {
  return `const scenes=${JSON.stringify(offsets)};window.renderFrame=time=>{let index=scenes.findIndex(s=>time>=s.start&&time<s.start+s.duration);if(index<0)index=scenes.length-1;document.querySelectorAll('iframe').forEach((frame,i)=>{frame.style.visibility=i===index?'visible':'hidden';if(i===index)frame.contentWindow.postMessage({framescript:true,type:'seek',value:Math.max(0,time-scenes[i].start)},'*');});};`;
}
export function composeProject(p: Project): Project {
  if (!p.workflow) return p;
  const duration = totalDuration(p),
    scenes = p.workflow.scenes;
  const attr = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
  const html = scenes
    .map(
      (s, i) =>
        `<iframe id="scene-${i}" data-start="${sceneOffset(p, s.id)}" title="${attr(s.title)}" sandbox="allow-scripts" srcdoc="${attr(documentFor({ ...p, assets: [], workflow: undefined, audio: undefined, html: s.html, css: s.css, js: s.js, settings: { ...p.settings, duration: s.duration } }, { sourceOffset: s.sourceOffset, visualDuration: s.visualDuration, visualContinuations: s.visualContinuations, textEditing: false }))}"></iframe>`,
    )
    .join("\n");
  const offsets = scenes.map((s) => ({
    start: sceneOffset(p, s.id),
    duration: s.duration,
  }));
  const js = compositionScript(offsets);
  return {
    ...p,
    workflow: undefined,
    html,
    css: compositionCss,
    js,
    settings: { ...p.settings, duration },
    audio: p.audio?.map((a) => ({
      ...a,
      start: a.start + (a.sceneId ? sceneOffset(p, a.sceneId) : 0),
      sceneId: undefined,
    })),
  };
}
